import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../../s3/s3.service';
import { EmailSenderService } from '../../email/email-sender.service';
import { emailConfig } from '../../../config/email.config';
import { DealAnalysis, ValidationResult } from './agentic-types';

@Injectable()
export class AgenticDeliveryService {
  private readonly logger = new Logger(AgenticDeliveryService.name);
  private readonly config = emailConfig();

  constructor(
    private readonly s3: S3Service,
    private readonly emailSender: EmailSenderService,
  ) {}

  async deliver(params: {
    senderEmail: string;
    dealId: string;
    proformaS3Key: string;
    analysis: DealAnalysis;
    validation?: ValidationResult;
    correctionsApplied?: number;
    inReplyToMessageId?: string;
  }): Promise<void> {
    const {
      senderEmail,
      dealId,
      proformaS3Key,
      analysis,
      validation,
      correctionsApplied,
      inReplyToMessageId,
    } = params;

    const buffer = await this.s3.downloadDealAttachment(proformaS3Key);

    const propertyAddress = analysis.propertyAddress || dealId;
    const subject = `Underwriting Complete: ${propertyAddress}`;

    const html = this.buildResultHtml(
      analysis,
      dealId,
      senderEmail,
      validation,
      correctionsApplied,
    );

    const ccAddresses = this.config.adminEmails.filter(
      (addr) => addr.toLowerCase() !== senderEmail.toLowerCase(),
    );

    await this.emailSender.sendEmail({
      to: [senderEmail],
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      subject,
      html,
      from: this.config.underwritingInboundEmail
        ? `Dealwire <${this.config.underwritingInboundEmail}>`
        : undefined,
      replyToMessageId: inReplyToMessageId,
      attachments: [
        {
          filename: 'proforma_filled.xlsx',
          content: buffer.toString('base64'),
        },
      ],
    });

    this.logger.log(
      `[${dealId}] Underwriting results delivered to ${senderEmail}`,
    );
  }

  private buildResultHtml(
    analysis: DealAnalysis,
    dealId: string,
    senderEmail?: string,
    validation?: ValidationResult,
    correctionsApplied?: number,
  ): string {
    const fmt = (n: number | null | undefined, prefix = '', suffix = '') =>
      n !== null && n !== undefined
        ? `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
        : '<em>&mdash;</em>';

    const fmtPct = (n: number | null | undefined) =>
      n !== null && n !== undefined
        ? `${(n * 100).toFixed(1)}%`
        : '<em>&mdash;</em>';

    const missingDocsHtml =
      analysis.missingDocs.length > 0
        ? `<p style="color:#b45309;"><strong>Missing documents:</strong> ${analysis.missingDocs.join(', ')} &mdash; re-send to fill remaining fields.</p>`
        : '';

    const flagsHtml =
      analysis.flags.length > 0
        ? `<h3 style="color:#b45309;">Notes &amp; Flags</h3><ul>${analysis.flags.map((f) => `<li>${f}</li>`).join('')}</ul>`
        : '<p style="color:#15803d;">No flags</p>';

    const analystHtml = analysis.analystNotes
      ? `<h3>Analyst Notes</h3><p style="color:#374151;line-height:1.6;">${analysis.analystNotes}</p>`
      : '';

    const verdictLabel = validation
      ? {
          pass: 'Passed',
          pass_with_warnings: 'Passed with warnings',
          fail: 'Review needed',
        }[validation.verdict]
      : undefined;

    const verdictColor = validation
      ? {
          pass: '#15803d',
          pass_with_warnings: '#b45309',
          fail: '#dc2626',
        }[validation.verdict]
      : undefined;

    return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
  <h2 style="border-bottom:2px solid #2563eb;padding-bottom:8px;">Underwriting Complete</h2>
  <p><strong>Deal ID:</strong> ${dealId}</p>
  ${senderEmail ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Requested by ${senderEmail}</p>` : ''}
  ${analysis.propertyAddress ? `<p><strong>Property:</strong> ${analysis.propertyAddress}${analysis.city ? `, ${analysis.city}` : ''}${analysis.state ? `, ${analysis.state}` : ''}</p>` : ''}

  ${analystHtml}

  <h3>Key Metrics</h3>
  <table style="border-collapse:collapse;width:100%;">
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Asking Price</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.askingPrice, '$')}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>NOI</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.noi, '$')} / yr</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Cap Rate</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(analysis.capRate)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Total Units</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.totalUnits)}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Occupancy</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(analysis.occupancyRate)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Gross Rental Income</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.grossRentalIncome, '$')}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Effective Gross Income</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.effectiveGrossIncome, '$')}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Operating Expenses</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.operatingExpenses, '$')}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Expense Ratio</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(analysis.expenseRatio)}</td>
    </tr>
    ${
      analysis.pricePerUnit
        ? `<tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Price / Unit</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(analysis.pricePerUnit, '$')}</td>
    </tr>`
        : ''
    }
  </table>

  ${missingDocsHtml}
  ${flagsHtml}

  ${
    validation
      ? `<h3>Pro Forma QA Check</h3>
  <p><strong>Verdict:</strong> <span style="color:${verdictColor};font-weight:bold;">${verdictLabel}</span>
  ${correctionsApplied ? ` &mdash; ${correctionsApplied} correction(s) applied automatically` : ''}</p>
  ${validation.issues.length > 0 ? `<ul style="font-size:14px;">${validation.issues.map((i) => `<li style="color:${i.severity === 'error' ? '#dc2626' : i.severity === 'warning' ? '#b45309' : '#6b7280'};">[${i.severity.toUpperCase()}] ${i.description}</li>`).join('')}</ul>` : ''}`
      : ''
  }

  <p style="margin-top:24px;color:#6b7280;font-size:13px;">
    The filled pro forma is attached. Review and adjust assumptions as needed.
  </p>
</body>
</html>`;
  }
}
