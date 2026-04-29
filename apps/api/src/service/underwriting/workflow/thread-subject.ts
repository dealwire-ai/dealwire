import { DealAnalysis } from './workflow-types';

/**
 * Canonical thread subject for an underwriting conversation. Every outbound
 * email in the thread (ask, clarification, fill delivery, rerun delivery)
 * uses the same base so Outlook/Gmail group them. Replies prefix `Re:`.
 */
export function buildThreadSubject(
  property: string | null | undefined,
  rootRunId: string,
  isReply: boolean,
): string {
  const prop = (property || '').trim() || 'your deal';
  const short = rootRunId.slice(0, 8);
  const base = `Underwriting: ${prop} [UW-${short}]`;
  return isReply ? `Re: ${base}` : base;
}

/** Best-effort human label for the deal — used as the thread subject's property. */
export function threadPropertyLabel(
  analysis: DealAnalysis | null | undefined,
): string {
  if (!analysis) return '';
  return analysis.propertyName || analysis.propertyAddress || '';
}
