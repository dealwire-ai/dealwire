import { Injectable } from '@nestjs/common';
import { marked } from 'marked';
import { DealDecision } from '../../model/deal-decision.model';

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
      const decisionText = decision.decision === 'yes' ? 'Yes' : 'No';
      const decisionColor = decision.decision === 'yes' ? color : '#dc2626';
      const decisionBg = decision.decision === 'yes' ? '#f0f9ff' : '#fef2f2';
      const decisionBorder = decision.decision === 'yes' ? color : '#dc2626';

      decisionHtml = `
        <div style="background-color: ${decisionBg}; border-left: 4px solid ${decisionBorder}; padding: 16px 20px; margin: 0 0 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: ${decisionColor};">
            Decision: ${decisionText}
          </p>
          <p style="margin: 0; font-size: 14px; color: #666666; font-style: italic;">
            ${decision.reason}
          </p>
        </div>
      `;
    }

    const logoImgTag = `<img src="${logo}" alt="${company}" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        .markdown-body {
            color: #333333;
            line-height: 1.7;
            font-size: 14px;
        }
        .markdown-body h1 {
            color: ${color};
            font-size: 24px;
            font-weight: 600;
            margin: 24px 0 16px 0;
            border-bottom: 2px solid ${color};
            padding-bottom: 8px;
        }
        .markdown-body h2 {
            color: ${color};
            font-size: 18px;
            font-weight: 600;
            margin: 20px 0 12px 0;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 6px;
        }
        .markdown-body h3 {
            color: ${color};
            font-size: 16px;
            font-weight: 600;
            margin: 16px 0 10px 0;
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
            color: ${color};
            font-weight: 600;
        }
        .markdown-body table {
            border-collapse: collapse;
            margin: 16px 0;
            width: 100%;
        }
        .markdown-body th, .markdown-body td {
            border: 1px solid #e0e0e0;
            padding: 8px 12px;
            text-align: left;
        }
        .markdown-body th {
            background-color: #f5f5f5;
            font-weight: 600;
            color: ${color};
        }
        .markdown-body code {
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        .markdown-body pre {
            background-color: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .markdown-body pre code {
            background-color: transparent;
            padding: 0;
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                    <tr>
                        <td style="padding: 25px 30px; text-align: center; background-color: #ffffff; border-bottom: 2px solid ${color};">
                            ${logoImgTag}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            ${decisionHtml}
                            <div class="markdown-body">
                                ${htmlSummary}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 30px; background-color: #fafafa; border-top: 1px solid #e0e0e0; text-align: center; font-size: 11px; color: #999999;">
                            <p style="margin: 0;">${company}</p>
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

