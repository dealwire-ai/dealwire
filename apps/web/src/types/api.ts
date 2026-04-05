export interface Deal {
  id: string;
  sourceSubject: string | null;
  sourceFrom: string | null;
  sourceReceivedAt: string | null;
  initialScreeningSummary: string | null;
  detectionConfidence: string | null;
  detectionReason: string | null;
  folderMovedTo: string | null;
  sourceMessageId?: string | null;
  assetId?: string | null;
  contactId?: string | null;
  createdAt: string;
  updatedAt: string;
  receivedByUser?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  initialScreening?: {
    decision: "YES" | "NO";
    reason: string;
  } | null;
  documents?: Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
}

export interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  normalizedAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnderwritingRun {
  id: string;
  dealId: string | null;
  proformaId: string | null;
  jobId: string;
  senderEmail: string;
  emailSubject: string | null;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  analysisData?: Record<string, unknown> | null;
  filledProformaModelS3Key: string | null;
  humanReviewFlags: string[];
  confidence: number | null;
  durationMs: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}
