import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { S3Service } from '../s3/s3.service';
import { SQSService } from '../sqs/sqs.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnderwritingInboundService {
  private readonly logger = new Logger(UnderwritingInboundService.name);

  constructor(
    private readonly emailProcessing: EmailProcessingService,
    private readonly s3Service: S3Service,
    private readonly sqsService: SQSService,
    private readonly prisma: PrismaService,
  ) {}

  async handleEmail(emailData: any): Promise<void> {
    const emailId = emailData.email_id as string;
    const fromRaw: string = emailData.from || '';
    const subject: string = emailData.subject || '';

    this.logger.log(
      `Underwriting inbound email: ${emailId} from ${fromRaw} - "${subject}"`,
    );

    // Look up sender org so the pipeline knows whose pro forma template to use
    const fromEmail = this.extractEmail(fromRaw).toLowerCase();
    let orgId = '';
    if (fromEmail) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { email: fromEmail },
          select: { organizationId: true },
        });
        orgId = user?.organizationId || '';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to look up org for ${fromEmail}: ${msg}`);
      }
    }

    if (!orgId) {
      this.logger.warn(
        `No org found for sender ${fromEmail} — proceeding without orgId`,
      );
    }

    // Fetch attachment metadata from Resend
    const attachments = await this.emailProcessing.fetchAttachments(emailId);
    if (attachments.length === 0) {
      this.logger.warn(
        `Underwriting email ${emailId} has no attachments — skipping`,
      );
      return;
    }

    const jobId = this.generateJobId();
    const documents: Array<{
      s3Key: string;
      filename: string;
      contentType: string;
    }> = [];

    for (const att of attachments) {
      try {
        const response = await fetch(att.downloadUrl);
        if (!response.ok) {
          this.logger.warn(
            `Failed to download ${att.filename} (HTTP ${response.status}) — skipping`,
          );
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        // S3 key: deals/uw_{jobId}/{timestamp}-{filename}
        const s3Key = await this.s3Service.uploadDealAttachment(
          buffer,
          att.filename,
          jobId,
        );
        documents.push({
          s3Key,
          filename: att.filename,
          contentType: att.contentType,
        });
        this.logger.debug(`Uploaded ${att.filename} → ${s3Key}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to process attachment ${att.filename}: ${msg}`);
      }
    }

    if (documents.length === 0) {
      this.logger.warn(
        `No documents successfully uploaded for job ${jobId} — skipping enqueue`,
      );
      return;
    }

    await this.sqsService.enqueueUnderwritingJob({
      type: 'underwriting-job',
      dealId: jobId,
      orgId,
      senderEmail: fromEmail,
      documents,
    });

    this.logger.log(
      `Underwriting job ${jobId} enqueued with ${documents.length} document(s) from ${fromEmail}`,
    );
  }

  private extractEmail(value: string): string {
    const match = value.match(/<([^>]+)>/);
    return match ? match[1].trim() : value.trim();
  }

  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `uw_${timestamp}_${random}`;
  }
}
