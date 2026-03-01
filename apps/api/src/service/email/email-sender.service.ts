import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { emailConfig } from '../../config/email.config';

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private resend: Resend;
  private config: ReturnType<typeof emailConfig>;

  constructor() {
    this.config = emailConfig();

    if (!this.config.resendApiKey) {
      throw new Error('RESEND_API_KEY must be provided');
    }

    this.resend = new Resend(this.config.resendApiKey);
    this.logger.log(`Resend initialized with from email: ${this.config.fromEmail}`);
  }

  async sendEmail(params: {
    to: string[];
    subject: string;
    html: string;
    text?: string;
    replyToMessageId?: string;
    attachments?: Array<{ filename: string; content: string }>;
  }): Promise<string | null> {
    try {
      const emailParams: any = {
        from: this.config.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      };

      if (params.text) {
        emailParams.text = params.text;
      }

      if (params.replyToMessageId) {
        emailParams.headers = {
          'In-Reply-To': params.replyToMessageId,
          References: params.replyToMessageId,
        };
      }

      if (params.attachments?.length) {
        emailParams.attachments = params.attachments;
      }

      const response = await this.resend.emails.send(emailParams);

      const emailId = response.data?.id || null;

      this.logger.log(
        `Email sent to ${params.to.join(', ')}: ${params.subject} (ID: ${emailId})`,
      );

      return emailId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send email to ${params.to.join(', ')}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  getApiKey(): string {
    return this.config.resendApiKey;
  }
}

