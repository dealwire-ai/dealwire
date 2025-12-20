export interface EmailConfig {
  resendApiKey: string;
  resendWebhookSecret: string;
  fromEmail: string;
}

export const emailConfig = (): EmailConfig => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  fromEmail: process.env.FROM_EMAIL || 'Deal Analyzer <mail.deals@frontstep.ai>',
});
