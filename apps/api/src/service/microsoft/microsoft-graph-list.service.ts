import { Injectable, Logger } from '@nestjs/common';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

/** Minimal message fields returned by listMessages */
export interface GraphMessageSummary {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  receivedDateTime: string;
  hasAttachments: boolean;
  bodyPreview: string;
}

export interface ListMessagesResult {
  messages: GraphMessageSummary[];
  nextLink: string | null;
}

export interface ListMessagesOptions {
  folderId?: string;
  startDate?: Date;
  endDate?: Date;
  top?: number;
  nextLink?: string;
}

@Injectable()
export class MicrosoftGraphListService {
  private readonly logger = new Logger(MicrosoftGraphListService.name);
  private lastRequestTime = 0;

  /** Minimum ms between Graph API calls (~3.3 req/s) */
  private readonly MIN_REQUEST_INTERVAL_MS = 300;

  /**
   * List messages from a mail folder with pagination and date filtering.
   * Returns minimal fields to reduce payload size.
   */
  async listMessages(
    accessToken: string,
    options: ListMessagesOptions = {},
  ): Promise<ListMessagesResult> {
    await this.throttle();

    const url = options.nextLink || this.buildListUrl(options);

    const response = await this.fetchWithRetry(accessToken, url);
    if (!response) {
      return { messages: [], nextLink: null };
    }

    const data = await response.json();

    return {
      messages: (data.value || []) as GraphMessageSummary[],
      nextLink: data['@odata.nextLink'] || null,
    };
  }

  private buildListUrl(options: ListMessagesOptions): string {
    const folder = options.folderId || 'Inbox';
    const top = options.top || 50;

    const selectFields = [
      'id',
      'subject',
      'from',
      'receivedDateTime',
      'hasAttachments',
      'bodyPreview',
    ];

    const filters: string[] = [];
    if (options.startDate) {
      filters.push(
        `receivedDateTime ge ${options.startDate.toISOString()}`,
      );
    }
    if (options.endDate) {
      filters.push(
        `receivedDateTime le ${options.endDate.toISOString()}`,
      );
    }

    let url = `${GRAPH_BASE_URL}/me/mailFolders('${folder}')/messages?$select=${selectFields.join(',')}&$top=${top}&$orderby=receivedDateTime desc`;

    if (filters.length > 0) {
      url += `&$filter=${filters.join(' and ')}`;
    }

    return url;
  }

  /**
   * Fetch with 429 retry handling.
   * Returns null on non-recoverable errors.
   */
  private async fetchWithRetry(
    accessToken: string,
    url: string,
    maxRetries = 3,
  ): Promise<Response | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('Retry-After') || '30',
            10,
          );
          this.logger.warn(
            `Rate limited (429). Waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`,
          );
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Non-retryable error
        const errorText = await response.text();
        this.logger.error(
          `Graph API error ${response.status}: ${errorText}`,
        );
        return null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Graph API request failed (attempt ${attempt}/${maxRetries}): ${msg}`,
        );
        if (attempt < maxRetries) {
          await this.sleep(1000 * attempt);
        }
      }
    }

    return null;
  }

  /** Enforce minimum interval between requests */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL_MS) {
      await this.sleep(this.MIN_REQUEST_INTERVAL_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
