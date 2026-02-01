export type EmailSource = 'resend' | 'microsoft';

export interface NormalizedEmailAttachment {
  filename: string;
  contentType: string;
  size?: number;
  /** For Resend: download URL. For Microsoft: attachment ID */
  contentId: string;
  /** S3 key where attachment is stored (if already uploaded) */
  s3Key?: string;
}

export interface NormalizedEmailEvent {
  source: EmailSource;
  /** Original message ID from the provider */
  messageId: string;
  /** User ID in our system (for Microsoft - identifies whose mailbox) */
  userId?: string;
  from: string;
  /** Sender display name if available (e.g. from Graph or "Name <email>" header) */
  fromName?: string;
  to: string[];
  subject: string;
  /** HTML body if available */
  bodyHtml?: string;
  /** Plain text body */
  bodyText?: string;
  attachments: NormalizedEmailAttachment[];
  receivedAt: Date;
  /** Original provider-specific data for debugging/edge cases */
  rawData?: unknown;
}


