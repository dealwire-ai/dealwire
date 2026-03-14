import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderService } from '../email/email-sender.service';
import { ADMIN_EMAILS } from '../../config/email.config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly emailSender: EmailSenderService) {}

  /**
   * Send a custom notification email to admins. Public wrapper for use by other services.
   */
  async sendCustom(subject: string, html: string): Promise<void> {
    await this.sendEmailNotification(subject, html);
  }

  /**
   * Send email notification to admins
   */
  private async sendEmailNotification(
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      await this.emailSender.sendEmail({
        to: ADMIN_EMAILS,
        subject,
        html,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send notification email: ${msg}`);
    }
  }

  /**
   * Notify about processing errors
   */
  async notifyError(
    messageId: string,
    subject: string,
    error: string,
    stage: string,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff0000;">
          🚨 Processing Error
        </h2>
        <div style="background: #ffe6e6; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff0000;">
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Stage:</strong> ${stage}</p>
          <p><strong>Message ID:</strong> ${messageId}</p>
          <p><strong>Error:</strong></p>
          <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">${error.substring(0, 2000)}</pre>
        </div>
        <p style="color: #666; font-size: 12px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    await this.sendEmailNotification(`🚨 Processing Error: ${subject}`, html);
  }
}
