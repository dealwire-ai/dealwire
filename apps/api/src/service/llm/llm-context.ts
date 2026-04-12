import { AsyncLocalStorage } from 'async_hooks';

/**
 * In-memory accumulator carried along with an LLM context. When the context
 * represents an underwriting run, every tracked LLM call mutates this object
 * so the orchestrator can read the totals at run completion.
 */
export interface LlmRunAccumulator {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  costByStage: Record<string, number>;
  promptTokensByStage: Record<string, number>;
  completionTokensByStage: Record<string, number>;
  callCount: number;
}

export interface LlmContextStore {
  /** UnderwritingRun.id when inside an underwriting run. */
  runId?: string;
  dealId?: string;
  organizationId?: string;
  /** Current pipeline stage — e.g. 'extraction.om', 'field_mapping'. */
  stage?: string;
  /** Populated by withLlmContext; absent outside a run. */
  accumulator?: LlmRunAccumulator;
}

export const llmContextStorage = new AsyncLocalStorage<LlmContextStore>();

function emptyAccumulator(): LlmRunAccumulator {
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCostUsd: 0,
    costByStage: {},
    promptTokensByStage: {},
    completionTokensByStage: {},
    callCount: 0,
  };
}

/**
 * Run `fn` with an LLM context attached. Seeds a fresh accumulator on the
 * provided store so the caller can read per-run totals after `fn` resolves.
 *
 * Usage pattern (orchestrator):
 *   const store: LlmContextStore = { runId, dealId, organizationId };
 *   await withLlmContext(store, async () => { ...run body... });
 *   // After: store.accumulator holds the totals.
 *
 * The same `store` object is used as the AsyncLocalStorage value so the caller
 * can read `store.accumulator` after `fn` resolves without another lookup.
 */
export async function withLlmContext<T>(
  store: LlmContextStore,
  fn: () => Promise<T>,
): Promise<T> {
  store.accumulator = emptyAccumulator();
  return llmContextStorage.run(store, fn);
}

export function getLlmContext(): LlmContextStore | undefined {
  return llmContextStorage.getStore();
}

/** Mutate the current context's stage. Safe to call outside a context (no-op). */
export function setStage(stage: string): void {
  const store = llmContextStorage.getStore();
  if (store) store.stage = stage;
}

/**
 * Record a completed LLM call into the current context's accumulator.
 * No-op outside a context (e.g. chat agent called ad-hoc).
 */
export function recordInAccumulator(
  stage: string,
  promptTokens: number,
  completionTokens: number,
  costUsd: number,
): void {
  const store = llmContextStorage.getStore();
  if (!store?.accumulator) return;
  const acc = store.accumulator;
  acc.totalPromptTokens += promptTokens;
  acc.totalCompletionTokens += completionTokens;
  acc.totalCostUsd += costUsd;
  acc.callCount += 1;
  acc.costByStage[stage] = (acc.costByStage[stage] ?? 0) + costUsd;
  acc.promptTokensByStage[stage] =
    (acc.promptTokensByStage[stage] ?? 0) + promptTokens;
  acc.completionTokensByStage[stage] =
    (acc.completionTokensByStage[stage] ?? 0) + completionTokens;
}
