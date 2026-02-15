export interface InitialScreeningResult {
  decision: 'yes' | 'no';
  reason: string;
  assetId?: string | null; // Asset ID if address was extracted and normalized
  contactId?: string | null; // Contact ID if contact was found or created
  bucketId?: string | null; // ScreeningBucket ID the deal was classified into
  bucketName?: string | null; // ScreeningBucket name for display
}

// Keep DealDecision for backward compatibility during migration
export type DealDecision = InitialScreeningResult;
