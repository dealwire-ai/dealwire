import { Logger } from '@nestjs/common';

/**
 * LLM pricing in USD per 1M tokens, keyed by the model name string that
 * `model-config.ts` resolves to (matching what `generateObject`/OpenAI SDK see).
 *
 * Sources (check before editing):
 * - OpenAI:    https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing#api
 *
 * Keep this list in sync with the models returned by `model-config.ts`. When
 * adding a new model slot there, add a pricing entry here at the same time.
 */
export const LLM_PRICING: Record<
  string,
  { inputUsdPer1M: number; outputUsdPer1M: number }
> = {
  // OpenAI
  'gpt-4.1': { inputUsdPer1M: 2.0, outputUsdPer1M: 8.0 },
  'gpt-4.1-mini': { inputUsdPer1M: 0.4, outputUsdPer1M: 1.6 },

  // Anthropic
  'claude-sonnet-4-6': { inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  'claude-haiku-4-5-20251001': { inputUsdPer1M: 1.0, outputUsdPer1M: 5.0 },
};

const logger = new Logger('LlmPricing');
const warnedUnknownModels = new Set<string>();

/**
 * Compute USD cost for a completed LLM call.
 *
 * Returns 0 for unknown models (with a one-shot warning log) so observability
 * never crashes a request — cost becomes a lower bound until the pricing
 * table is updated.
 */
export function priceUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const entry = LLM_PRICING[model];
  if (!entry) {
    if (!warnedUnknownModels.has(model)) {
      warnedUnknownModels.add(model);
      logger.warn(
        `No pricing entry for model "${model}" — cost will be recorded as $0. Add it to LLM_PRICING in llm-pricing.ts.`,
      );
    }
    return 0;
  }
  const inputCost = (promptTokens / 1_000_000) * entry.inputUsdPer1M;
  const outputCost = (completionTokens / 1_000_000) * entry.outputUsdPer1M;
  return inputCost + outputCost;
}

/** Test-only: reset the "warned" set so tests can assert warning behavior. */
export function __resetPricingWarnings() {
  warnedUnknownModels.clear();
}
