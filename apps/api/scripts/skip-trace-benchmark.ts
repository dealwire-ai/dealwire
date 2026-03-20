/**
 * Skip trace provider benchmark — A/B test hit rates across providers.
 *
 * Usage:
 *   cd apps/api && npx tsx scripts/skip-trace-benchmark.ts --size 100 --providers tracerfy --filter not_found
 *
 * Flags:
 *   --size N           Number of BBLs to sample (default: 50)
 *   --providers a,b    Which providers to run (default: tracerfy)
 *   --filter mode      Which BBLs to sample: not_found | untraced | all (default: all)
 *   --write            Actually write results to DB (dry-run by default)
 */

import { PrismaClient } from '@prisma/client';
import { parseArgs } from 'node:util';

// Inline types (script runs outside NestJS DI)
interface OwnerPhone {
  number: string;
  type: string;
  rank: number;
}

interface SkipTraceInput {
  bbl: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface SkipTraceResult {
  bbl: string;
  phones: OwnerPhone[];
  emails: string[];
  found: boolean;
}

const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

// --- Tracerfy provider (standalone, no NestJS) ---

interface TracerfyResultRecord {
  primary_phone?: string;
  [key: string]: string | undefined;
}

async function tracerfyTrace(
  inputs: SkipTraceInput[],
): Promise<SkipTraceResult[]> {
  const apiKey = process.env.TRACERFY_API_KEY;
  if (!apiKey) throw new Error('TRACERFY_API_KEY not set');

  const baseUrl = 'https://tracerfy.com/v1/api';
  const jsonData = inputs.map((i) => ({
    first_name: i.firstName,
    last_name: i.lastName,
    address: i.address,
    city: i.city,
    state: i.state,
    zip: i.zip,
    mail_address: i.address,
    mail_city: i.city,
    mail_state: i.state,
    mailing_zip: i.zip,
  }));

  const formData = new FormData();
  formData.append('json_data', JSON.stringify(jsonData));
  formData.append('address_column', 'address');
  formData.append('city_column', 'city');
  formData.append('state_column', 'state');
  formData.append('zip_column', 'zip');
  formData.append('first_name_column', 'first_name');
  formData.append('last_name_column', 'last_name');
  formData.append('mail_address_column', 'mail_address');
  formData.append('mail_city_column', 'mail_city');
  formData.append('mail_state_column', 'mail_state');
  formData.append('mailing_zip_column', 'mailing_zip');
  formData.append('trace_type', 'normal');

  console.log(`  Submitting ${inputs.length} records to Tracerfy...`);
  const res = await fetch(`${baseUrl}/trace/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tracerfy POST /trace/ failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as { queue_id: string | number };
  const queueId = String(data.queue_id);
  console.log(`  Queue ${queueId} submitted, polling...`);

  // Poll until complete
  const maxAttempts = 20;
  const intervalMs = 15_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const pollRes = await fetch(`${baseUrl}/queue/${queueId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) {
      console.log(
        `  Poll attempt ${attempt}/${maxAttempts} failed: ${pollRes.status}`,
      );
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (await pollRes.json()) as any;
    let records: TracerfyResultRecord[] | null = null;

    if (Array.isArray(raw)) {
      records = raw;
    } else if (raw.pending === false) {
      records = Array.isArray(raw.results) ? raw.results : [];
    }

    if (records) {
      console.log(
        `  Queue ${queueId} complete after ${attempt * 15}s, ${records.length} records`,
      );
      return inputs.map((input, i) => {
        const rec = records![i];
        if (!rec)
          return { bbl: input.bbl, phones: [], emails: [], found: false };

        const phones = parsePhones(rec);
        const emails = parseEmails(rec);
        return {
          bbl: input.bbl,
          phones,
          emails,
          found: phones.length > 0 || emails.length > 0,
        };
      });
    }

    console.log(`  Poll attempt ${attempt}/${maxAttempts}: still pending`);
  }

  throw new Error(
    `Tracerfy queue ${queueId} timed out after ${maxAttempts} attempts`,
  );
}

function parsePhones(rec: TracerfyResultRecord): OwnerPhone[] {
  const seen = new Set<string>();
  const phones: OwnerPhone[] = [];
  const add = (raw: string | undefined, type: string, rank: number) => {
    if (!raw?.trim()) return;
    const num = raw.trim();
    if (seen.has(num)) return;
    seen.add(num);
    phones.push({ number: num, type, rank });
  };
  add(rec.primary_phone, 'primary', 1);
  for (let n = 1; n <= 5; n++)
    add(rec[`mobile_${n}`], 'mobile', phones.length + 1);
  for (let n = 1; n <= 3; n++)
    add(rec[`landline_${n}`], 'landline', phones.length + 1);
  return phones;
}

function parseEmails(rec: TracerfyResultRecord): string[] {
  const emails: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const e = rec[`email_${n}`]?.trim();
    if (e) emails.push(e);
  }
  return emails;
}

// --- Provider registry ---

const PROVIDERS: Record<
  string,
  (inputs: SkipTraceInput[]) => Promise<SkipTraceResult[]>
> = {
  tracerfy: tracerfyTrace,
  // Add new providers here: thedatagroup: tdgTrace, etc.
};

// --- Main ---

async function main() {
  const { values } = parseArgs({
    options: {
      size: { type: 'string', default: '50' },
      providers: { type: 'string', default: 'tracerfy' },
      filter: { type: 'string', default: 'all' },
      write: { type: 'boolean', default: false },
    },
  });

  const size = parseInt(values.size!, 10);
  const providerNames = values.providers!.split(',');
  const filter = values.filter as 'not_found' | 'untraced' | 'all';
  const write = values.write!;

  // Validate provider names
  for (const name of providerNames) {
    if (!PROVIDERS[name]) {
      console.error(
        `Unknown provider: ${name}. Available: ${Object.keys(PROVIDERS).join(', ')}`,
      );
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();

  try {
    // Build filter for BBL sampling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter === 'not_found') {
      where.skipTraceStatus = 'not_found';
    } else if (filter === 'untraced') {
      where.skipTraceStatus = null;
    }
    // 'all' = no filter

    // Require ownerName to exist (needed for skip tracing)
    where.ownerName = { not: null };

    const totalAvailable = await prisma.parcel.count({ where });
    console.log(
      `\nFilter: ${filter} | Available parcels: ${totalAvailable} | Sample size: ${size}`,
    );

    if (totalAvailable === 0) {
      console.log('No parcels match the filter. Nothing to benchmark.');
      return;
    }

    // Random sample: order by bbl (deterministic), skip random offset
    const skip = Math.max(
      0,
      Math.floor(Math.random() * (totalAvailable - size)),
    );
    const parcels = await prisma.parcel.findMany({
      where,
      select: {
        bbl: true,
        ownerName: true,
        address: true,
        zipCode: true,
        borough: true,
      },
      orderBy: { bbl: 'asc' },
      skip,
      take: size,
    });

    console.log(`Sampled ${parcels.length} parcels\n`);

    // Build inputs
    const inputs: SkipTraceInput[] = parcels.map((p) => {
      const nameParts = (p.ownerName || '').trim().split(/\s+/);
      return {
        bbl: p.bbl,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        address: p.address || '',
        city: BOROUGH_NAMES[p.borough] || 'New York',
        state: 'NY',
        zip: p.zipCode || '',
      };
    });

    // Run each provider on the same inputs
    const allResults: Record<string, SkipTraceResult[]> = {};

    for (const name of providerNames) {
      console.log(`--- Running provider: ${name} ---`);
      const start = Date.now();
      const results = await PROVIDERS[name](inputs);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      allResults[name] = results;

      const found = results.filter((r) => r.found).length;
      const withPhones = results.filter((r) => r.phones.length > 0).length;
      const withEmails = results.filter((r) => r.emails.length > 0).length;
      const totalPhones = results.reduce((s, r) => s + r.phones.length, 0);

      console.log(`\n  Results (${elapsed}s):`);
      console.log(`    Total:        ${results.length}`);
      console.log(
        `    Found:        ${found} (${((found / results.length) * 100).toFixed(1)}%)`,
      );
      console.log(
        `    With phones:  ${withPhones} (${((withPhones / results.length) * 100).toFixed(1)}%)`,
      );
      console.log(
        `    With emails:  ${withEmails} (${((withEmails / results.length) * 100).toFixed(1)}%)`,
      );
      console.log(
        `    Avg phones/hit: ${found > 0 ? (totalPhones / found).toFixed(1) : 'N/A'}`,
      );
      console.log();

      // Write results if --write flag is set
      if (write) {
        console.log(`  Writing results to DB...`);
        const now = new Date();
        for (const result of results) {
          await prisma.parcel.updateMany({
            where: { bbl: result.bbl },
            data: {
              ...(result.phones.length > 0 && {
                ownerPhones: result.phones as unknown as object[],
              }),
              ...(result.emails.length > 0 && { ownerEmails: result.emails }),
              skipTraceStatus: result.found ? 'found' : 'not_found',
              skipTracedAt: now,
              skipTraceQueueId: null,
            },
          });
        }
        console.log(`  Written ${results.length} results.\n`);
      } else {
        console.log(`  Dry run — pass --write to persist results.\n`);
      }
    }

    // Head-to-head comparison if multiple providers
    if (providerNames.length > 1) {
      console.log('=== Head-to-Head Comparison ===\n');

      const header = ['Metric', ...providerNames];
      const rows: string[][] = [];

      const metrics = [
        {
          label: 'Hit rate',
          fn: (r: SkipTraceResult[]) =>
            `${((r.filter((x) => x.found).length / r.length) * 100).toFixed(1)}%`,
        },
        {
          label: 'Phone rate',
          fn: (r: SkipTraceResult[]) =>
            `${((r.filter((x) => x.phones.length > 0).length / r.length) * 100).toFixed(1)}%`,
        },
        {
          label: 'Email rate',
          fn: (r: SkipTraceResult[]) =>
            `${((r.filter((x) => x.emails.length > 0).length / r.length) * 100).toFixed(1)}%`,
        },
        {
          label: 'Avg phones/hit',
          fn: (r: SkipTraceResult[]) => {
            const found = r.filter((x) => x.found);
            if (found.length === 0) return 'N/A';
            return (
              found.reduce((s, x) => s + x.phones.length, 0) / found.length
            ).toFixed(1);
          },
        },
      ];

      for (const m of metrics) {
        rows.push([m.label, ...providerNames.map((n) => m.fn(allResults[n]))]);
      }

      // Print table
      const colWidths = header.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => r[i].length)),
      );
      const divider = colWidths.map((w) => '-'.repeat(w + 2)).join('+');

      console.log(
        header.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|'),
      );
      console.log(divider);
      for (const row of rows) {
        console.log(row.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join('|'));
      }
      console.log();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
