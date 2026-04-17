import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../../s3/s3.service';
import { EmailSenderService } from '../../email/email-sender.service';
import { emailConfig } from '../../../config/email.config';
import { ResolvedMetrics } from './extraction-reconciler.service';
import { ExtractionResults } from '../extractors/extraction-types';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private readonly config = emailConfig();

  constructor(
    private readonly s3: S3Service,
    private readonly emailSender: EmailSenderService,
  ) {}

  async deliver(params: {
    senderEmail: string;
    dealId: string;
    proformaS3Key: string;
    normalized: ResolvedMetrics;
    extraction: ExtractionResults;
    inReplyToMessageId?: string;
  }): Promise<void> {
    const {
      senderEmail,
      dealId,
      proformaS3Key,
      normalized,
      extraction,
      inReplyToMessageId,
    } = params;

    // Download filled proforma
    const buffer = await this.s3.downloadDealAttachment(proformaS3Key);

    const propertyAddress = extraction.om?.propertyAddress || dealId;
    const subject = `Underwriting Complete: ${propertyAddress}`;

    const html = this.buildResultHtml(
      normalized,
      extraction,
      dealId,
      senderEmail,
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
    normalized: ResolvedMetrics,
    extraction: ExtractionResults,
    dealId: string,
    senderEmail?: string,
  ): string {
    const { om, t12 } = extraction;
    const {
      reconciledNoi,
      reconciledOccupancyRate,
      reconciledTotalUnits,
      annualGrossRent,
      effectiveGrossIncome,
      expenseRatio,
      capRate,
      flags,
      missingDocs,
    } = normalized;

    const fmt = (n: number | null | undefined, prefix = '', suffix = '') =>
      n !== null && n !== undefined
        ? `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
        : '<em>—</em>';

    const fmtPct = (n: number | null | undefined) =>
      n !== null && n !== undefined ? `${(n * 100).toFixed(1)}%` : '<em>—</em>';

    const missingDocsHtml =
      missingDocs.length > 0
        ? `<p style="color:#b45309;"><strong>Missing documents:</strong> ${missingDocs.join(', ')} — re-send to fill remaining fields.</p>`
        : '';

    const flagsHtml =
      flags.length > 0
        ? `<h3 style="color:#b45309;">⚠ Notes &amp; Flags</h3><ul>${flags.map((f) => `<li>${f}</li>`).join('')}</ul>`
        : '<p style="color:#15803d;">✓ No flags</p>';

    return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
  <h2 style="border-bottom:2px solid #2563eb;padding-bottom:8px;">Underwriting Complete</h2>
  <p><strong>Deal ID:</strong> ${dealId}</p>
  ${senderEmail ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Requested by ${senderEmail}</p>` : ''}
  ${om?.propertyAddress ? `<p><strong>Property:</strong> ${om.propertyAddress}${om.city ? `, ${om.city}` : ''}${om.state ? `, ${om.state}` : ''}</p>` : ''}

  <h3>Key Metrics</h3>
  <table style="border-collapse:collapse;width:100%;">
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Asking Price</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(om?.askingPrice, '$')}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Reconciled NOI</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(reconciledNoi, '$')} / yr</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Cap Rate</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(capRate)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Total Units</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(reconciledTotalUnits)}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Occupancy</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(reconciledOccupancyRate)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Annual Gross Rent</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(annualGrossRent, '$')}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Effective Gross Income</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(effectiveGrossIncome, '$')}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Expense Ratio</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmtPct(expenseRatio)}</td>
    </tr>
    ${
      t12?.operatingExpenses !== null && t12?.operatingExpenses !== undefined
        ? `
    <tr style="background:#f3f4f6;">
      <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Operating Expenses (T-12)</strong></td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${fmt(t12.operatingExpenses, '$')}</td>
    </tr>`
        : ''
    }
  </table>

  ${missingDocsHtml}
  ${flagsHtml}

  <p style="margin-top:24px;color:#6b7280;font-size:13px;">
    The filled pro forma is attached. Review and adjust assumptions as needed.
  </p>
</body>
</html>`;
  }
}
