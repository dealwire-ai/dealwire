export interface UnderwritingDocument {
  s3Key: string;
  filename: string;
  contentType: string;
}

export interface UnderwritingJobContext {
  dealId: string;
  orgId: string;
  senderEmail: string;
  emailSubject?: string;
  documents: UnderwritingDocument[];
  inReplyToMessageId?: string;
}

export interface UnderwritingResult {
  dealId: string;
  status: 'completed' | 'failed' | 'waiting_for_assumptions';
  filledProformaModelS3Key?: string;
  humanReviewFlags: string[];
  durationMs: number;
  analysisData?: Record<string, unknown>;
  confidence?: number;
  proformaId?: string;
}
