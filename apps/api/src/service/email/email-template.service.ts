import { Injectable } from '@nestjs/common';
import { marked } from 'marked';
import { InitialScreeningResult, DealDecision } from '../../model/initial-screening.model';

@Injectable()
export class EmailTemplateService {
  formatSummaryAsHtml(
    summary: string,
    decision?: DealDecision,
    logoUrl?: string,
    companyName?: string,
    brandColor?: string,
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
}

