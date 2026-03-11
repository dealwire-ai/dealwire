import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { IngestionResult } from './nyc-ingestion.service';
import * as cheerio from 'cheerio';

const CARE_BASE = 'https://a836-pts-access.nyc.gov/care';

/** Servicer name normalization */
const SERVICER_MAP: Record<string, string> = {
  'TOWER CAPITAL MANAGEMENT LLC': 'Tower',
  'TOWER CAPITAL MANAGEMENT': 'Tower',
  TOWER: 'Tower',
  'MOORING TAX ASSET GROUP LLC': 'MTAG',
  'MOORING TAX ASSET GROUP': 'MTAG',
  MTAG: 'MTAG',
};

function normalizeServicer(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return SERVICER_MAP[upper] || raw.trim();
}

/** Borough code (1-5) to CARE's borough number used in search form */
const CARE_BORO_MAP: Record<string, string> = {
  '1': '1', // Manhattan
  '2': '2', // Bronx
  '3': '3', // Brooklyn
  '4': '4', // Queens
  '5': '5', // Staten Island
};

interface LienCard {
  saleAmount: number;
  servicer: string;
  status: string; // "S Sold", "R Post Sale Redeemed", etc.
  saleDate: string | null;
  redemptionDate: string | null;
  taxYear: string | null;
  redeemed: boolean;
}

interface CareSession {
  cookies: CookieJar;
  viewState: string;
  eventValidation: string;
  viewStateGenerator: string;
  searchCount: number;
}

/**
 * Lightweight cookie jar — only tracks ASP.NET_SessionId + DISCLAIMER cookies.
 */
class CookieJar {
  private cookies = new Map<string, string>();

  update(response: Response): void {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookies) {
      const match = header.match(/^([^=]+)=([^;]*)/);
      if (match) {
        this.cookies.set(match[1], match[2]);
      }
    }
  }

  toString(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

@Injectable()
export class CareScraperService {
  private readonly logger = new Logger(CareScraperService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Scrape a single BBL — useful for testing/debugging.
   */
  async scrapeSingle(bbl: string): Promise<LienCard[]> {
    const borough = bbl[0];
    const block = String(parseInt(bbl.substring(1, 6)));
    const lot = String(parseInt(bbl.substring(6, 10)));

    const session = await this.initSession();
    const dataletUrl = await this.searchProperty(session, borough, block, lot);
    if (!dataletUrl) {
      this.logger.warn(`No CARE result for BBL ${bbl}`);
      return [];
    }

    const liens = await this.scrapeAccountHistory(session, dataletUrl, bbl);
    this.logger.log(
      `BBL ${bbl}: found ${liens.length} lien(s) — ${JSON.stringify(liens)}`,
    );
    return liens;
  }

  /**
   * Main entry: scrape all active-lien parcels across parallel workers.
   */
  async scrapeAll(): Promise<IngestionResult> {
    if (this.running) {
      throw new Error('CARE scraper is already running');
    }
    this.running = true;
    const start = Date.now();

    try {
      // Load all parcels with active liens
      const parcels = await this.prisma.parcel.findMany({
        where: { hasActiveLien: true },
        select: { bbl: true },
      });

      this.logger.log(
        `Starting CARE scraper for ${parcels.length} active-lien parcels`,
      );

      if (parcels.length === 0) {
        return {
          source: 'care_scraper',
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          durationMs: Date.now() - start,
        };
      }

      // Split parcels across 3 workers
      const workerCount = 3;
      const chunks = this.chunkArray(
        parcels.map((p) => p.bbl),
        workerCount,
      );

      const workerResults = await Promise.allSettled(
        chunks.map((chunk, i) => this.runWorker(i, chunk)),
      );

      // Aggregate results
      let totalProcessed = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const result of workerResults) {
        if (result.status === 'fulfilled') {
          totalProcessed += result.value.processed;
          totalUpdated += result.value.updated;
          totalErrors += result.value.errors;
        } else {
          this.logger.error(`Worker failed: ${result.reason}`);
          totalErrors++;
        }
      }

      const durationMs = Date.now() - start;
      const durationMin = Math.round(durationMs / 1000 / 60);

      this.logger.log(
        `CARE scraper complete: ${totalProcessed} processed, ${totalUpdated} updated, ${totalErrors} errors in ${durationMin} min`,
      );

      // Send notification
      await this.notifyComplete(
        totalProcessed,
        totalUpdated,
        totalErrors,
        durationMin,
      );

      return {
        source: 'care_scraper',
        recordsProcessed: totalProcessed,
        recordsCreated: 0,
        recordsUpdated: totalUpdated,
        durationMs,
      };
    } catch (err) {
      const durationMin = Math.round((Date.now() - start) / 1000 / 60);
      await this.notifyFailed((err as Error).message, durationMin);
      throw err;
    } finally {
      this.running = false;
    }
  }

  /**
   * One worker: owns a session, processes its chunk sequentially.
   */
  private async runWorker(
    workerId: number,
    bbls: string[],
  ): Promise<{ processed: number; updated: number; errors: number }> {
    this.logger.log(`Worker ${workerId}: starting with ${bbls.length} BBLs`);

    let session = await this.initSession();
    let processed = 0;
    let updated = 0;
    let errors = 0;
    let consecutiveErrors = 0;

    for (const bbl of bbls) {
      try {
        const borough = bbl[0];
        const block = String(parseInt(bbl.substring(1, 6)));
        const lot = String(parseInt(bbl.substring(6, 10)));

        const dataletUrl = await this.searchProperty(
          session,
          borough,
          block,
          lot,
        );
        processed++;

        if (dataletUrl) {
          const liens = await this.scrapeAccountHistory(
            session,
            dataletUrl,
            bbl,
          );
          if (liens.length > 0) {
            await this.saveLienData(bbl, liens);
            updated++;
          }
        }

        consecutiveErrors = 0;
        session.searchCount++;

        // Session refresh every 500 searches
        if (session.searchCount >= 500) {
          this.logger.log(
            `Worker ${workerId}: refreshing session after ${session.searchCount} searches`,
          );
          session = await this.initSession();
        }

        // Random jitter between requests
        await this.randomDelay();
      } catch (err) {
        errors++;
        consecutiveErrors++;
        this.logger.warn(
          `Worker ${workerId}: error on BBL ${bbl}: ${(err as Error).message}`,
        );

        // 5 consecutive errors → reinitialize session
        if (consecutiveErrors >= 5) {
          this.logger.warn(
            `Worker ${workerId}: ${consecutiveErrors} consecutive errors, reinitializing session`,
          );
          try {
            session = await this.initSession();
            consecutiveErrors = 0;
          } catch (sessionErr) {
            this.logger.error(
              `Worker ${workerId}: session reinit failed: ${(sessionErr as Error).message}`,
            );
          }
        }

        await this.randomDelay();
      }

      // Log progress every 100 BBLs
      if (processed % 100 === 0) {
        this.logger.log(
          `Worker ${workerId}: ${processed}/${bbls.length} processed, ${updated} updated, ${errors} errors`,
        );
      }
    }

    this.logger.log(
      `Worker ${workerId}: done — ${processed} processed, ${updated} updated, ${errors} errors`,
    );
    return { processed, updated, errors };
  }

  /**
   * 3-step CARE handshake to establish a session.
   * 1. GET search page → redirect to Disclaimer, capture session cookie
   * 2. POST Disclaimer with btAgree → capture DISCLAIMER cookie
   * 3. GET search page again → capture ViewState for form submissions
   */
  private async initSession(): Promise<CareSession> {
    const cookies = new CookieJar();

    // Step 1: GET search page — follows redirect to Disclaimer
    const step1 = await this.fetchWithRetry(
      `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
      { redirect: 'manual' },
    );
    cookies.update(step1);

    // Follow redirect to Disclaimer page
    const disclaimerUrl =
      step1.headers.get('location') ||
      `${CARE_BASE}/Search/Disclaimer.aspx?FromUrl=search/commonsearch.aspx?mode=persprop`;
    const fullDisclaimerUrl = disclaimerUrl.startsWith('http')
      ? disclaimerUrl
      : `https://a836-pts-access.nyc.gov${disclaimerUrl}`;

    const disclaimerPage = await this.fetchWithRetry(fullDisclaimerUrl, {
      headers: { Cookie: cookies.toString() },
    });
    cookies.update(disclaimerPage);
    const disclaimerHtml = await disclaimerPage.text();
    const disclaimerFields = this.parseAspNetFormFields(disclaimerHtml);

    // Step 2: POST Disclaimer with Agree
    const agreeBody = new URLSearchParams({
      __VIEWSTATE: disclaimerFields.viewState,
      __EVENTVALIDATION: disclaimerFields.eventValidation,
      __VIEWSTATEGENERATOR: disclaimerFields.viewStateGenerator,
      btAgree: 'Agree',
    });

    const step2 = await this.fetchWithRetry(fullDisclaimerUrl, {
      method: 'POST',
      headers: {
        Cookie: cookies.toString(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: agreeBody.toString(),
      redirect: 'manual',
    });
    cookies.update(step2);

    // Step 3: GET search page — now we have the session + disclaimer cookies
    const step3 = await this.fetchWithRetry(
      `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
      {
        headers: { Cookie: cookies.toString() },
      },
    );
    cookies.update(step3);
    const searchHtml = await step3.text();
    const searchFields = this.parseAspNetFormFields(searchHtml);

    if (!searchFields.viewState) {
      // Debug: log first 500 chars to help diagnose
      this.logger.warn(
        `No ViewState found in search page. HTML preview: ${searchHtml.substring(0, 500)}`,
      );
      throw new Error('Failed to capture ViewState from CARE search page');
    }

    this.logger.debug('CARE session initialized successfully');

    return {
      cookies,
      viewState: searchFields.viewState,
      eventValidation: searchFields.eventValidation,
      viewStateGenerator: searchFields.viewStateGenerator,
      searchCount: 0,
    };
  }

  /**
   * POST search form to find a property by borough/block/lot.
   * Returns the datalet URL if found, or null if no results.
   */
  private async searchProperty(
    session: CareSession,
    borough: string,
    block: string,
    lot: string,
  ): Promise<string | null> {
    const careBorough = CARE_BORO_MAP[borough];
    if (!careBorough) {
      this.logger.warn(`Invalid borough code for CARE: ${borough}`);
      return null;
    }

    const body = new URLSearchParams({
      __VIEWSTATE: session.viewState,
      __EVENTVALIDATION: session.eventValidation,
      __VIEWSTATEGENERATOR: session.viewStateGenerator,
      inpParid: careBorough,
      inpTag: block, // Must be unpadded
      inpStat: lot, // Must be unpadded
      btSearch: 'Search',
    });

    const response = await this.fetchWithRetry(
      `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
      {
        method: 'POST',
        headers: {
          Cookie: session.cookies.toString(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        redirect: 'manual',
      },
    );
    session.cookies.update(response);

    // Success = redirect to datalet page
    const location = response.headers.get('location');
    if (
      (location && location.includes('Datalet')) ||
      (location && location.includes('datalet'))
    ) {
      const fullUrl = location.startsWith('http')
        ? location
        : `https://a836-pts-access.nyc.gov${location}`;
      return fullUrl;
    }

    // No redirect = no results found (or error page)
    // Check if we got a 200 with search results (some properties return a list)
    if (response.status === 200) {
      const html = await response.text();
      // Check for datalet link in search results
      const $ = cheerio.load(html);
      const dataletLink = $('a[href*="datalet.aspx"]').first().attr('href');
      if (dataletLink) {
        return dataletLink.startsWith('http')
          ? dataletLink
          : `https://a836-pts-access.nyc.gov${dataletLink.startsWith('/') ? '' : '/care/'}${dataletLink}`;
      }

      // Update viewstate from the response for next search
      const fields = this.parseAspNetFormFields(html);
      if (fields.viewState) {
        session.viewState = fields.viewState;
        session.eventValidation = fields.eventValidation;
        session.viewStateGenerator = fields.viewStateGenerator;
      }
    }

    return null;
  }

  /**
   * Navigate to the Account History Summary page and parse lien cards.
   */
  private async scrapeAccountHistory(
    session: CareSession,
    dataletUrl: string,
    bbl: string,
  ): Promise<LienCard[]> {
    // Extract sIndex from the datalet URL
    const sIndexMatch = dataletUrl.match(/sIndex=(\d+)/i);
    const sIndex = sIndexMatch ? sIndexMatch[1] : '0';

    // Navigate to account history summary
    const accHistUrl = `${CARE_BASE}/Datalets/datalet.aspx?mode=acc_hist_summ&sIndex=${sIndex}&idx=1&LMparent=20`;

    const response = await this.fetchWithRetry(accHistUrl, {
      headers: { Cookie: session.cookies.toString() },
    });
    session.cookies.update(response);

    const html = await response.text();
    const liens = this.parseLienCards(html, bbl);

    // Check for additional lien cards (multi-lien properties)
    const $ = cheerio.load(html);
    const cardLinks = $('a[href*="card="]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((href) => href && !href.includes('card=0'));

    for (const cardLink of cardLinks) {
      const cardUrl = cardLink.startsWith('http')
        ? cardLink
        : `https://a836-pts-access.nyc.gov${cardLink.startsWith('/') ? '' : '/care/'}${cardLink}`;

      await this.randomDelay();
      const cardResponse = await this.fetchWithRetry(cardUrl, {
        headers: { Cookie: session.cookies.toString() },
      });
      session.cookies.update(cardResponse);

      const cardHtml = await cardResponse.text();
      const cardLiens = this.parseLienCards(cardHtml, bbl);
      liens.push(...cardLiens);
    }

    return liens;
  }

  /**
   * Parse lien data from a CARE account history page.
   * Looks for lien sale information in the HTML tables/datalets.
   */
  private parseLienCards(html: string, bbl: string): LienCard[] {
    const $ = cheerio.load(html);
    const liens: LienCard[] = [];

    // CARE displays lien info in table rows. Look for rows containing lien sale data.
    // The page uses a table-based layout with labels and values.

    // Strategy: find all text content, look for lien-related patterns
    const allText = $.text();

    // Check if this page actually has lien data
    if (
      !allText.includes('Lien') &&
      !allText.includes('lien') &&
      !allText.includes('LIEN') &&
      !allText.includes('Tax Lien Sale')
    ) {
      return liens;
    }

    // Parse table-based layout: look for labeled value pairs
    // CARE uses <td> with class or specific structure for labels and values
    let saleAmount = 0;
    let servicer = '';
    let status = '';
    let saleDate: string | null = null;
    let redemptionDate: string | null = null;
    let taxYear: string | null = null;

    // Look for specific patterns in table cells
    $('tr').each((_, row) => {
      const cells = $(row).find('td');
      cells.each((i, cell) => {
        const text = $(cell).text().trim();
        const nextCell = cells.eq(i + 1);
        const nextText = nextCell.length ? nextCell.text().trim() : '';

        // Sale Amount patterns
        if (
          text.match(/sale\s*amount/i) ||
          text.match(/amount\s*sold/i) ||
          text.match(/lien\s*amount/i)
        ) {
          const amount = parseFloat(nextText.replace(/[$,\s]/g, ''));
          if (!isNaN(amount) && amount > 0) {
            saleAmount = amount;
          }
        }

        // Servicer
        if (text.match(/servicer/i) || text.match(/purchaser/i)) {
          if (nextText) {
            servicer = normalizeServicer(nextText);
          }
        }

        // Status
        if (text.match(/status/i) && !text.match(/foreclosure/i)) {
          if (nextText && nextText.length < 100) {
            status = nextText;
          }
        }

        // Sale Date
        if (text.match(/sale\s*date/i)) {
          if (nextText) {
            saleDate = nextText;
          }
        }

        // Redemption Date
        if (
          text.match(/redemption\s*date/i) ||
          text.match(/redeemed\s*date/i)
        ) {
          if (nextText) {
            redemptionDate = nextText;
          }
        }

        // Tax Year
        if (text.match(/tax\s*year/i) || text.match(/fiscal\s*year/i)) {
          if (nextText) {
            taxYear = nextText;
          }
        }
      });
    });

    // Also check for amount in specific patterns within text blocks
    if (saleAmount === 0) {
      // Look for dollar amounts near lien-related keywords
      const amountMatch = allText.match(
        /(?:sale\s*amount|amount\s*sold|lien\s*amount)[:\s]*\$?([\d,]+\.?\d*)/i,
      );
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          saleAmount = amount;
        }
      }
    }

    // Look for dollar amounts in specific labeled spans/divs
    if (saleAmount === 0) {
      $('[class*="DataletData"], [class*="datalet"]').each((_, el) => {
        const text = $(el).text().trim();
        const amountMatch = text.match(/\$?([\d,]+\.\d{2})/);
        if (amountMatch) {
          const prevText = $(el).prev().text().trim();
          if (prevText.match(/sale\s*amount/i) || prevText.match(/amount/i)) {
            saleAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
          }
        }
      });
    }

    const redeemed =
      status.toLowerCase().includes('redeem') || !!redemptionDate;

    if (saleAmount > 0 || status || servicer) {
      liens.push({
        saleAmount,
        servicer,
        status,
        saleDate,
        redemptionDate,
        taxYear,
        redeemed,
      });
    }

    return liens;
  }

  /**
   * Parse ASP.NET form hidden fields from HTML.
   */
  private parseAspNetFormFields(html: string): {
    viewState: string;
    eventValidation: string;
    viewStateGenerator: string;
  } {
    const $ = cheerio.load(html);
    return {
      viewState: ($('#__VIEWSTATE').val() as string) || '',
      eventValidation: ($('#__EVENTVALIDATION').val() as string) || '',
      viewStateGenerator: ($('#__VIEWSTATEGENERATOR').val() as string) || '',
    };
  }

  /**
   * Save scraped lien data to DB.
   * Most recent lien (by sale date) becomes the primary.
   * lienSaleAmount = sum of all lien amounts (multi-lien properties).
   */
  private async saveLienData(bbl: string, liens: LienCard[]): Promise<void> {
    if (liens.length === 0) return;

    // Sort by sale date descending (most recent first)
    const sorted = [...liens].sort((a, b) => {
      if (!a.saleDate && !b.saleDate) return 0;
      if (!a.saleDate) return 1;
      if (!b.saleDate) return -1;
      return b.saleDate.localeCompare(a.saleDate);
    });

    const primary = sorted[0];
    const totalAmount = liens.reduce((sum, l) => sum + l.saleAmount, 0);
    const allRedeemed = liens.every((l) => l.redeemed);
    const anyUnredeemed = liens.some((l) => !l.redeemed);

    await this.prisma.parcel.updateMany({
      where: { bbl },
      data: {
        lienSaleAmount:
          totalAmount > 0 ? Math.round(totalAmount * 100) / 100 : null,
        lienServicer: primary.servicer || null,
        lienRedeemed: allRedeemed ? true : anyUnredeemed ? false : null,
        lienSaleDate: primary.saleDate || null,
        lienStatus: primary.status || null,
        lienRedemptionDate: primary.redemptionDate || null,
        lienMatchConfidence: 'care_exact',
        lienMatchGroupSize: 1,
        careSyncedAt: new Date(),
      },
    });
  }

  /**
   * Fetch with exponential backoff retry.
   */
  private async fetchWithRetry(
    url: string,
    init?: RequestInit & { redirect?: RequestRedirect },
    retries = 3,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Don't retry on redirects (3xx) — they're expected
        if (response.status >= 300 && response.status < 400) {
          return response;
        }

        // Retry on 5xx
        if (response.status >= 500 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Fetch ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
          );
          await this.sleep(delay);
          continue;
        }

        return response;
      } catch (err) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Fetch ${url} failed: ${(err as Error).message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
          );
          await this.sleep(delay);
        } else {
          throw err;
        }
      }
    }

    throw new Error(
      `fetchWithRetry exhausted all ${retries} retries for ${url}`,
    );
  }

  /** 300-500ms random jitter */
  private randomDelay(): Promise<void> {
    const ms = 300 + Math.random() * 200;
    return this.sleep(ms);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(arr: T[], chunks: number): T[][] {
    const result: T[][] = Array.from({ length: chunks }, () => []);
    for (let i = 0; i < arr.length; i++) {
      result[i % chunks].push(arr[i]);
    }
    return result;
  }

  private async notifyComplete(
    processed: number,
    updated: number,
    errors: number,
    durationMin: number,
  ): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#22c55e;">CARE Scraper Complete</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 12px;">Parcels processed</td><td style="padding:6px 12px;text-align:right;font-weight:bold;">${processed.toLocaleString()}</td></tr>
          <tr><td style="padding:6px 12px;">Updated with lien data</td><td style="padding:6px 12px;text-align:right;font-weight:bold;">${updated.toLocaleString()}</td></tr>
          <tr><td style="padding:6px 12px;">Errors</td><td style="padding:6px 12px;text-align:right;font-weight:bold;">${errors}</td></tr>
          <tr><td style="padding:6px 12px;">Duration</td><td style="padding:6px 12px;text-align:right;font-weight:bold;">${durationMin} min</td></tr>
        </table>
        <p style="color:#666;font-size:12px;margin-top:16px;">${new Date().toLocaleString()}</p>
      </div>`;

    try {
      await this.notifications.sendCustom('CARE scraper complete', html);
    } catch (err) {
      this.logger.warn(
        `Failed to send CARE completion email: ${(err as Error).message}`,
      );
    }
  }

  private async notifyFailed(
    error: string,
    durationMin: number,
  ): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#ef4444;">CARE Scraper Failed</h2>
        <p>Failed after: <strong>${durationMin} min</strong></p>
        <pre style="background:#1a1a1a;color:#f87171;padding:12px;border-radius:6px;overflow-x:auto;">${error.substring(0, 2000)}</pre>
        <p style="color:#666;font-size:12px;margin-top:16px;">${new Date().toLocaleString()}</p>
      </div>`;

    try {
      await this.notifications.sendCustom('CARE scraper FAILED', html);
    } catch (err) {
      this.logger.warn(
        `Failed to send CARE failure email: ${(err as Error).message}`,
      );
    }
  }
}
