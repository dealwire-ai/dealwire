import { Injectable, Logger } from '@nestjs/common';
import { marked } from 'marked';
import { PrismaService } from '../prisma/prisma.service';
import { DealwireAgentService } from '../agent/dealwire-agent.service';
import { EmailSenderService } from '../email/email-sender.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { emailConfig } from '../../config/email.config';

@Injectable()
export class ScreeningInboundService {
  private readonly logger = new Logger(ScreeningInboundService.name);
  private readonly config = emailConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dealwireAgent: DealwireAgentService,
    private readonly emailSender: EmailSenderService,
    private readonly emailProcessing: EmailProcessingService,
  ) {}

  async handleEmail(emailData: any): Promise<void> {
    const emailId = emailData.email_id as string;
    const fromRaw: string = emailData.from || '';
    const subject: string = emailData.subject || '';

    this.logger.log(
      `Screening command email: ${emailId} from ${fromRaw} - "${subject}"`,
    );

    const fromEmail = this.extractEmail(fromRaw).toLowerCase();

    // Look up the sender's org
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
        `No org found for sender ${fromEmail} — cannot process screening command`,
      );
      return;
    }

    // Fetch the email body text from Resend
    const { text: bodyText } =
      await this.emailProcessing.extractEmailBody(emailId);
    const userMessage = (bodyText || '').trim();

    if (!userMessage) {
      this.logger.warn(
        `Screening command email ${emailId} has no body — skipping`,
      );
      return;
    }

    const responseText = await this.dealwireAgent.generate(
      { organizationId: orgId },
      userMessage,
    );

    this.logger.log(
      `[ScreeningAgent] emailId=${emailId}\n` +
        `  QUERY: ${userMessage.slice(0, 1000)}\n` +
        `  RESPONSE: ${responseText.slice(0, 2000)}`,
    );

    const htmlBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${marked.parse(responseText) as string}</div>`;

    // Reply-to address: the screening inbound address (same address user emailed)
    const toAddress: string | string[] = emailData.to || '';
    const toAddresses = Array.isArray(toAddress) ? toAddress : [toAddress];
    const screeningAddr = toAddresses.find(
      (a) =>
        a.toLowerCase() ===
        (this.config.screeningInboundEmail || '').toLowerCase(),
    );

    // Resend delivers headers as an array of {name, value} objects
    const headersArray: Array<{ name: string; value: string }> = Array.isArray(
      emailData.headers,
    )
      ? emailData.headers
      : [];
    const messageIdHeader = headersArray.find(
      (h) => h.name?.toLowerCase() === 'message-id',
    );
    const replyToMessageId = messageIdHeader?.value || emailId;

    await this.emailSender.sendEmail({
      to: [fromEmail],
      from: screeningAddr || this.config.screeningInboundEmail || undefined,
      subject: subject.toLowerCase().startsWith('re:')
        ? subject
        : `Re: ${subject}`,
      html: htmlBody,
      replyToMessageId,
    });

    this.logger.log(`Replied to screening command from ${fromEmail}`);
  }

  private extractEmail(value: string): string {
    const match = value.match(/<([^>]+)>/);
    return match ? match[1].trim() : value.trim();
  }
}
