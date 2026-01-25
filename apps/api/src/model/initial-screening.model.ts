export interface InitialScreeningResult {
  decision: 'yes' | 'no';
  reason: string;
}

// Keep DealDecision for backward compatibility during migration
export type DealDecision = InitialScreeningResult;
