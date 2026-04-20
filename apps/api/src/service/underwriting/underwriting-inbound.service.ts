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

    const fromEmail = this.extractEmail(fromRaw).toLowerCase();

    const headersArray: Array<{ name: string; value: string }> = Array.isArray(
      emailData.headers,
    )
      ? emailData.headers
      : [];
    const inboundMessageId = this.findHeader(headersArray, 'message-id');
    const inReplyTo = this.findHeader(headersArray, 'in-reply-to');
    const autoSubmitted = this.findHeader(headersArray, 'auto-submitted');
    const precedence = this.findHeader(headersArray, 'precedence');
    const autoReply = this.findHeader(headersArray, 'x-autoreply');

    if (
      (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') ||
      (precedence && /auto[_-]?reply|bulk|list/i.test(precedence)) ||
      (autoReply && /yes/i.test(autoReply))
    ) {
      this.logger.log(
        `Underwriting email ${emailId} looks auto-generated (auto-submitted/precedence/x-autoreply) — skipping`,
      );
      return;
    }

    // ── Reply correlation ─────────────────────────────────────────────────
    const parentRun = await this.resolveParentRun(inReplyTo, subject);
    if (parentRun) {
      await this.handleReply({
        parentRunId: parentRun.id,
        senderEmail: fromEmail,
        rawBody: this.extractBody(emailData),
        inboundMessageId,
        inReplyToMessageId: inReplyTo,
      });
      return;
    }

    // ── New job flow ──────────────────────────────────────────────────────
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
        this.logger.warn(
          `Failed to process attachment ${att.filename}: ${msg}`,
        );
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
      emailSubject: subject || undefined,
      documents,
      inReplyToMessageId: inboundMessageId,
    });

    this.logger.log(
      `Underwriting job ${jobId} enqueued with ${documents.length} document(s) from ${fromEmail}`,
    );
  }

  /**
   * Look up the parent run for a reply.
   * Primary: RFC 5322 In-Reply-To matches a Message-ID we previously sent.
   * Fallback: subject contains [UW-{runShortId}] token (client stripped In-Reply-To).
   */
  private async resolveParentRun(
    inReplyTo: string | undefined,
    subject: string,
  ): Promise<{ id: string } | null> {
    if (inReplyTo) {
      const row = await this.prisma.underwritingRunMessage.findUnique({
        where: { messageId: inReplyTo },
        select: { runId: true, direction: true },
      });
      if (row && row.direction === 'OUTBOUND') {
        return { id: row.runId };
      }
    }

    const tokenMatch = subject.match(/\[UW-([a-z0-9]+)\]/i);
    if (tokenMatch) {
      const token = tokenMatch[1].toLowerCase();
      const run = await this.prisma.underwritingRun.findFirst({
        where: { id: { startsWith: token } },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (run) return run;
    }

    return null;
  }

  private async handleReply(params: {
    parentRunId: string;
    senderEmail: string;
    rawBody: string;
    inboundMessageId?: string;
    inReplyToMessageId?: string;
  }): Promise<void> {
    if (params.inboundMessageId) {
      const existing = await this.prisma.underwritingRunMessage.findUnique({
        where: { messageId: params.inboundMessageId },
        select: { id: true },
      });
      if (existing) {
        this.logger.log(
          `[${params.parentRunId}] Duplicate inbound messageId=${params.inboundMessageId} — skipping`,
        );
        return;
      }
    }

    await this.sqsService.enqueueUnderwritingReply({
      type: 'underwriting-reply-job',
      parentRunId: params.parentRunId,
      senderEmail: params.senderEmail,
      rawBody: params.rawBody,
      inboundMessageId: params.inboundMessageId,
      inReplyToMessageId: params.inReplyToMessageId,
    });

    this.logger.log(
      `[${params.parentRunId}] Reply enqueued from ${params.senderEmail}`,
    );
  }

  private findHeader(
    headers: Array<{ name: string; value: string }>,
    name: string,
  ): string | undefined {
    const match = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    );
    return match?.value || undefined;
  }

  private extractBody(emailData: any): string {
    return (
      (emailData.body_plain as string | undefined) ||
      (emailData.text as string | undefined) ||
      (emailData.body as string | undefined) ||
      ''
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
