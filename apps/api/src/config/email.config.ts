export const ADMIN_EMAILS = ['isaac@frontstep.ai', 'noah@frontstep.ai'];

export interface EmailConfig {
  resendApiKey: string;
  resendWebhookSecret: string;
  fromEmail: string;
  adminEmails: string[];
  underwritingInboundEmail: string;
  screeningInboundEmail: string;
}

export const emailConfig = (): EmailConfig => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  fromEmail: process.env.FROM_EMAIL || 'Dealwire <noreply@mail.dealwire.ai>',
  adminEmails: ADMIN_EMAILS,
  underwritingInboundEmail: process.env.UNDERWRITING_INBOUND_EMAIL || '',
  screeningInboundEmail: process.env.SCREENING_INBOUND_EMAIL || '',
});
