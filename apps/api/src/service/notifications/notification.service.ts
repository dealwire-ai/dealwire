import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderService } from '../email/email-sender.service';
import { ADMIN_EMAILS } from '../../config/email.config';

export type NotificationLevel = 'all' | 'errors-only' | 'digest-only';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly notificationLevel: NotificationLevel;

  constructor(private readonly emailSender: EmailSenderService) {
    this.notificationLevel = (process.env.NOTIFICATION_LEVEL as NotificationLevel) || 'all';
  }

  /**
   * Send email notification to admins
   */
  private async sendEmailNotification(subject: string, html: string): Promise<void> {
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
   * Notify about a new deal processed
   * @deprecated No longer used - admins now receive the original email via forward and analysis via reply
   */
  async notifyDealProcessed(
    dealId: string,
    subject: string,
    from: string,
    decision: 'yes' | 'no',
    reason: string,
    emailBodyText: string,
    attachmentS3Keys: string[],
    userId?: string,
    organizationName?: string,
  ): Promise<void> {
    if (process.env.NOTIFY_DEAL_PROCESSED === 'false') {
      return;
    }
    if (this.notificationLevel === 'errors-only') {
      return;
    }

    const emoji = decision === 'yes' ? '✅' : '❌';
    const decisionText = decision === 'yes' ? 'YES' : 'NO';
    const color = decision === 'yes' ? '#00ff00' : '#ff0000';

    // Truncate email body if too long (show first 2000 chars)
    const truncatedBody = emailBodyText.length > 2000 
      ? emailBodyText.substring(0, 2000) + '... (truncated)'
      : emailBodyText;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${color};">
          ${emoji} Deal Processed: ${decisionText}
        </h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>From:</strong> ${from}</p>
          ${organizationName ? `<p><strong>Organization:</strong> ${organizationName}</p>` : ''}
          ${dealId ? `<p><strong>Deal ID:</strong> ${dealId}</p>` : ''}
        </div>
        <div style="background: ${color}20; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${color};">
          <p><strong>Decision:</strong> ${decisionText}</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>
        ${emailBodyText ? `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Email Body:</h3>
          <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 12px; max-height: 400px; overflow-y: auto;">${this.escapeHtml(truncatedBody)}</pre>
        </div>
        ` : ''}
        ${attachmentS3Keys.length > 0 ? `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Attachments (S3 Keys):</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${attachmentS3Keys.map(key => `<li style="font-family: monospace; font-size: 12px; word-break: break-all;">${this.escapeHtml(key)}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        <p style="color: #666; font-size: 12px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    await this.sendEmailNotification(`Deal Processed: ${decisionText} - ${subject}`, html);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Notify about a high-confidence deal detection
   */
  async notifyHighConfidenceDeal(
    messageId: string,
    subject: string,
    confidence: string,
    userId?: string,
  ): Promise<void> {
    if (this.notificationLevel === 'errors-only') {
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00aaff;">
          🎯 High Confidence Deal Detected
        </h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Confidence:</strong> ${confidence}</p>
          <p><strong>Message ID:</strong> ${messageId}</p>
        </div>
        <p style="color: #666; font-size: 12px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    await this.sendEmailNotification(`High Confidence Deal: ${subject}`, html);
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

  /**
   * Notify about folder move
   */
  async notifyFolderMove(
    messageId: string,
    subject: string,
    folderName: string,
    decision: 'yes' | 'no',
  ): Promise<void> {
    if (this.notificationLevel === 'errors-only') {
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #888888;">
          📁 Email Moved
        </h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Folder:</strong> ${folderName}</p>
          <p><strong>Decision:</strong> ${decision.toUpperCase()}</p>
          <p><strong>Message ID:</strong> ${messageId}</p>
        </div>
        <p style="color: #666; font-size: 12px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    await this.sendEmailNotification(`Email Moved to ${folderName}: ${subject}`, html);
  }

  /**
   * Send daily digest summary
   */
  async sendDailyDigest(
    stats: {
      totalProcessed: number;
      deals: number;
      skipped: number;
      yesDecisions: number;
      noDecisions: number;
      errors: number;
    },
  ): Promise<void> {
    if (this.notificationLevel !== 'all' && this.notificationLevel !== 'digest-only') {
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00aaff;">
          📊 Daily Processing Summary
        </h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Processed:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${stats.totalProcessed}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Deals:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${stats.deals}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Skipped:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${stats.skipped}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>YES Decisions:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${stats.yesDecisions}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>NO Decisions:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${stats.noDecisions}</td>
            </tr>
            <tr>
              <td style="padding: 10px;"><strong>Errors:</strong></td>
              <td style="padding: 10px; text-align: right; color: ${stats.errors > 0 ? '#ff0000' : '#000'};">${stats.errors}</td>
            </tr>
          </table>
        </div>
        <p style="color: #666; font-size: 12px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    await this.sendEmailNotification('📊 Daily Processing Summary', html);
  }
}
