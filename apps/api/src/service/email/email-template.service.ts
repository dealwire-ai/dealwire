import { Injectable } from '@nestjs/common';
import { marked } from 'marked';
import { InitialScreeningResult, DealDecision } from '../../model/initial-screening.model';

export interface ActionCardData {
  originalEmailLink?: string;
  attachments?: Array<{ filename: string; url: string; contentType: string; sizeBytes?: number }>;
  brokerContext?: {
    name: string;
    email: string;
    totalDeals: number;
    passRate: number;
    topCities: string[];
    lastDealAt?: Date;
  };
  dealRoomLinks?: string[];
  caLinks?: string[];
}

@Injectable()
export class EmailTemplateService {
  formatSummaryAsHtml(
    summary: string,
    decision?: DealDecision,
    logoUrl?: string,
    companyName?: string,
    brandColor?: string,
    narrative?: string,
    actionCard?: ActionCardData,
  ): string {
    const htmlSummary = marked.parse(summary) as string;

    // Use provided values or fall back to defaults
    const logo = logoUrl;
    const company = companyName || 'Deal Analyzer';
    const color = brandColor || '#2A4A7C';

    // Format decision section if provided
    let decisionHtml = '';
    if (decision) {
      const isYes = decision.decision === 'yes';
      const decisionText = isYes ? 'Yes' : 'No';
      const accentColor = isYes ? '#16a34a' : '#dc2626';
      const pillBg = isYes ? '#dcfce7' : '#fee2e2';
      const pillText = isYes ? '#166534' : '#991b1b';

      decisionHtml = `
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 28px 0; border-collapse: collapse;">
          <tr>
            <td style="width: 4px; background-color: ${accentColor}; border-radius: 8px 0 0 8px;"></td>
            <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-left: none; border-radius: 0 8px 8px 0; padding: 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td>
                    <span style="font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Decision</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="background-color: ${pillBg}; color: ${pillText}; padding: 4px 14px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                      ${decisionText.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #374151; line-height: 1.6;">
                ${decision.reason}
              </p>
            </td>
          </tr>
        </table>
      `;
    }

    // Format narrative section if provided
    let narrativeHtml = '';
    if (narrative) {
      narrativeHtml = `
        <div style="background-color: #f8fafc; border-left: 4px solid ${color}; padding: 16px 20px; margin: 0 0 24px 0; border-radius: 4px; font-style: italic;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">The Story</p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            ${narrative}
          </p>
        </div>
      `;
    }

    // Format action card section if provided
    const actionCardHtml = this.renderActionCard(actionCard, color);

    const headerContent = logo
      ? `<img src="${logo}" alt="${company}" style="max-width: 160px; height: auto; display: block; margin: 0 auto;" />`
      : `<span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${company}</span>`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        .markdown-body {
            color: #374151;
            line-height: 1.7;
            font-size: 14px;
        }
        .markdown-body h1 {
            color: #111827;
            font-size: 22px;
            font-weight: 700;
            margin: 28px 0 14px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            letter-spacing: -0.3px;
        }
        .markdown-body h2 {
            color: #111827;
            font-size: 18px;
            font-weight: 700;
            margin: 24px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #f3f4f6;
            letter-spacing: -0.2px;
        }
        .markdown-body h3 {
            color: #111827;
            font-size: 16px;
            font-weight: 600;
            margin: 20px 0 10px 0;
        }
        .markdown-body p {
            margin: 12px 0;
            line-height: 1.7;
        }
        .markdown-body ul, .markdown-body ol {
            margin: 12px 0;
            padding-left: 24px;
        }
        .markdown-body li {
            margin: 6px 0;
            line-height: 1.6;
        }
        .markdown-body strong {
            color: #111827;
            font-weight: 600;
        }
        .markdown-body table {
            border-collapse: separate;
            border-spacing: 0;
            margin: 16px 0;
            width: 100%;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        .markdown-body th, .markdown-body td {
            border-bottom: 1px solid #f3f4f6;
            padding: 10px 14px;
            text-align: left;
        }
        .markdown-body th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .markdown-body code {
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        .markdown-body pre {
            background-color: #f9fafb;
            padding: 14px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            overflow-x: auto;
        }
        .markdown-body pre code {
            background-color: transparent;
            padding: 0;
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 800px; margin: 0 auto;">
                    <tr>
                        <td style="padding: 28px 32px; text-align: center; background-color: ${color};">
                            ${headerContent}
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 36px 36px 24px 36px;">
                            ${decisionHtml}
                            ${actionCardHtml}
                            ${narrativeHtml}
                            <div class="markdown-body">
                                ${htmlSummary}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 36px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">${company}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  /**
   * Render the action card section (quick actions + broker intel).
   */
  private renderActionCard(actionCard?: ActionCardData, color?: string): string {
    if (!actionCard) return '';
    const brandColor = color || '#2A4A7C';

    const hasQuickActions =
      actionCard.originalEmailLink ||
      (actionCard.attachments && actionCard.attachments.length > 0) ||
      (actionCard.dealRoomLinks && actionCard.dealRoomLinks.length > 0) ||
      (actionCard.caLinks && actionCard.caLinks.length > 0);

    let quickActionsHtml = '';
    if (hasQuickActions) {
      let linksHtml = '';

      if (actionCard.originalEmailLink) {
        linksHtml += `<p style="margin: 0 0 8px 0;"><a href="${actionCard.originalEmailLink}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">&rarr; View Original Email</a></p>`;
      }

      if (actionCard.attachments) {
        for (const att of actionCard.attachments) {
          const size = att.sizeBytes ? ` (${this.formatFileSize(att.sizeBytes)})` : '';
          linksHtml += `<p style="margin: 0 0 8px 0;"><a href="${att.url}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">&bull; ${att.filename}</a><span style="color: #94a3b8; font-size: 12px;">${size}</span></p>`;
        }
      }

      if (actionCard.dealRoomLinks) {
        for (const link of actionCard.dealRoomLinks) {
          linksHtml += `<p style="margin: 0 0 8px 0;"><a href="${link}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">&rarr; Deal Room</a></p>`;
        }
      }

      if (actionCard.caLinks) {
        for (const link of actionCard.caLinks) {
          linksHtml += `<p style="margin: 0 0 8px 0;"><a href="${link}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">&rarr; Sign CA/NDA</a></p>`;
        }
      }

      quickActionsHtml = `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 600; color: ${brandColor}; text-transform: uppercase; letter-spacing: 0.5px;">Quick Actions</p>
          ${linksHtml}
        </div>
      `;
    }

    let brokerHtml = '';
    if (actionCard.brokerContext) {
      const bc = actionCard.brokerContext;
      const citiesStr = bc.topCities.length > 0 ? `, focuses on ${bc.topCities.join(', ')}` : '';
      let lastDealStr = '';
      if (bc.lastDealAt) {
        lastDealStr = ` &middot; Last deal: ${this.timeAgo(bc.lastDealAt)}`;
      }
      brokerHtml = `
        <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px 0; font-size: 13px; color: #713f12;">
          <strong>${bc.name}</strong> &mdash; ${bc.totalDeals} deals sent, ${bc.passRate}% pass rate${citiesStr}${lastDealStr}
        </div>
      `;
    }

    return quickActionsHtml + brokerHtml;
  }

  /**
   * Format file size in human-readable form.
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format a date as a relative time string (e.g., "3 days ago").
   */
  private timeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    return `${diffMonths} months ago`;
  }
}

