import { Injectable, Logger } from '@nestjs/common';
import {
  SkipTraceProvider,
  SkipTraceInput,
  SkipTraceResult,
  OwnerPhone,
} from './skip-trace-provider.interface';

/** A single result record from GET /queue/:id (flat phone/email fields) */
interface TracerfyResultRecord {
  first_name?: string;
  last_name?: string;
  address?: string;
  primary_phone?: string;
  mobile_1?: string;
  mobile_2?: string;
  mobile_3?: string;
  mobile_4?: string;
  mobile_5?: string;
  landline_1?: string;
  landline_2?: string;
  landline_3?: string;
  email_1?: string;
  email_2?: string;
  email_3?: string;
  email_4?: string;
  email_5?: string;
  [key: string]: string | undefined;
}

/** Response from GET /queue/:id — pending:false means complete */
interface TracerfyQueueResponse {
  id?: number | string;
  queue_id?: number | string;
  pending?: boolean;
  results?: unknown[];
  [key: string]: unknown;
}

@Injectable()
export class TracerfyProvider implements SkipTraceProvider {
  readonly name = 'tracerfy';
  private readonly logger = new Logger(TracerfyProvider.name);
  private readonly apiKey = process.env.TRACERFY_API_KEY;
  private readonly baseUrl = 'https://tracerfy.com/v1/api';

  /** Map from queueId → resolver, so webhooks can short-circuit polling */
  private readonly pendingQueues = new Map<
    string,
    {
      resolve: (records: TracerfyResultRecord[]) => void;
      reject: (err: Error) => void;
    }
  >();

  async trace(inputs: SkipTraceInput[]): Promise<SkipTraceResult[]> {
    if (!this.apiKey) {
      throw new Error('TRACERFY_API_KEY is not configured');
    }

    const jsonData = inputs.map((input) => ({
      first_name: input.firstName,
      last_name: input.lastName,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      mail_address: input.address,
      mail_city: input.city,
      mail_state: input.state,
      mailing_zip: input.zip,
    }));

    this.logger.log(
      `Submitting ${jsonData.length} records to Tracerfy POST /trace/`,
    );

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

    const response = await fetch(`${this.baseUrl}/trace/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      this.logger.error(
        `Tracerfy POST /trace/ failed: status=${response.status}, body=${text}`,
      );
      throw new Error(`Tracerfy API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { queue_id: string | number };
    const queueId = String(data.queue_id);

    this.logger.log(`Tracerfy queue ${queueId} submitted, polling for results`);

    const records = await this.waitForResults(queueId);
    return this.mapResults(inputs, records);
  }

  /**
   * Handle a Tracerfy webhook callback. Short-circuits the polling loop
   * if we're currently waiting on this queue.
   */
  handleWebhookPayload(payload: TracerfyQueueResponse): void {
    const queueId = String(payload.id ?? payload.queue_id ?? '');
    if (!queueId) {
      this.logger.warn('Tracerfy webhook received with no queue ID');
      return;
    }

    const pending = this.pendingQueues.get(queueId);
    if (!pending) {
      this.logger.warn(
        `Tracerfy webhook for queue ${queueId}: no pending request found`,
      );
      return;
    }

    const results: TracerfyResultRecord[] = Array.isArray(payload)
      ? (payload as unknown as TracerfyResultRecord[])
      : Array.isArray(payload.results)
        ? (payload.results as TracerfyResultRecord[])
        : [];

    this.logger.log(
      `Tracerfy webhook resolved queue ${queueId} with ${results.length} records`,
    );
    pending.resolve(results);
  }

  async checkBalance(): Promise<number | null> {
    if (!this.apiKey) return null;

    const response = await fetch(`${this.baseUrl}/analytics/`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      this.logger.warn(
        `Failed to fetch Tracerfy credit balance: ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      credits?: number;
      balance?: number;
    };
    return data.credits ?? data.balance ?? 0;
  }

  /** Returns the Tracerfy queue ID for a set of inputs (for storing on parcels) */
  getLastQueueId(): string | null {
    return this._lastQueueId;
  }

  private _lastQueueId: string | null = null;

  private waitForResults(queueId: string): Promise<TracerfyResultRecord[]> {
    this._lastQueueId = queueId;

    return new Promise<TracerfyResultRecord[]>((resolve, reject) => {
      const maxAttempts = 20;
      const intervalMs = 15_000;
      let attempt = 0;
      let settled = false;

      const done = (records: TracerfyResultRecord[]) => {
        if (settled) return;
        settled = true;
        this.pendingQueues.delete(queueId);
        resolve(records);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        this.pendingQueues.delete(queueId);
        reject(err);
      };

      // Register so webhooks can resolve us
      this.pendingQueues.set(queueId, { resolve: done, reject: fail });

      const poll = async () => {
        if (settled) return;
        attempt++;

        try {
          const response = await fetch(`${this.baseUrl}/queue/${queueId}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });

          if (!response.ok) {
            this.logger.warn(
              `GET /queue/${queueId} failed: ${response.status} (attempt ${attempt}/${maxAttempts})`,
            );
            if (attempt < maxAttempts) {
              setTimeout(() => void poll(), intervalMs);
            } else {
              fail(
                new Error(
                  `Tracerfy queue ${queueId} polling failed after ${maxAttempts} attempts`,
                ),
              );
            }
            return;
          }

          const raw = (await response.json()) as
            | TracerfyResultRecord[]
            | TracerfyQueueResponse;

          if (Array.isArray(raw)) {
            done(raw);
            return;
          }

          if (raw.pending === false) {
            const results: TracerfyResultRecord[] = Array.isArray(raw.results)
              ? (raw.results as TracerfyResultRecord[])
              : [];
            done(results);
            return;
          }

          this.logger.debug(
            `Queue ${queueId} still pending (attempt ${attempt}/${maxAttempts})`,
          );

          if (attempt < maxAttempts) {
            setTimeout(() => void poll(), intervalMs);
          } else {
            fail(
              new Error(
                `Tracerfy queue ${queueId} timed out after ${maxAttempts} attempts`,
              ),
            );
          }
        } catch (err) {
          this.logger.error(
            `Poll error for queue ${queueId}: ${(err as Error).message}`,
          );
          if (attempt < maxAttempts) {
            setTimeout(() => void poll(), intervalMs);
          } else {
            fail(err as Error);
          }
        }
      };

      // Start polling after first interval
      setTimeout(() => void poll(), intervalMs);
    });
  }

  private mapResults(
    inputs: SkipTraceInput[],
    records: TracerfyResultRecord[],
  ): SkipTraceResult[] {
    return inputs.map((input, i) => {
      const record = records[i];
      if (!record) {
        return { bbl: input.bbl, phones: [], emails: [], found: false };
      }

      const phones = this.parsePhones(record);
      const emails = this.parseEmails(record);
      return {
        bbl: input.bbl,
        phones,
        emails,
        found: phones.length > 0 || emails.length > 0,
      };
    });
  }

  private parsePhones(result: TracerfyResultRecord): OwnerPhone[] {
    const seen = new Set<string>();
    const phones: OwnerPhone[] = [];

    const addPhone = (raw: string | undefined, type: string, rank: number) => {
      if (!raw || !raw.trim()) return;
      const number = raw.trim();
      if (seen.has(number)) return;
      seen.add(number);
      phones.push({ number, type, rank });
    };

    addPhone(result.primary_phone, 'primary', 1);

    for (let n = 1; n <= 5; n++) {
      addPhone(result[`mobile_${n}`], 'mobile', phones.length + 1);
    }

    for (let n = 1; n <= 3; n++) {
      addPhone(result[`landline_${n}`], 'landline', phones.length + 1);
    }

    return phones;
  }

  private parseEmails(result: TracerfyResultRecord): string[] {
    const emails: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const email = result[`email_${n}`]?.trim();
      if (email) emails.push(email);
    }
    return emails;
  }
}
