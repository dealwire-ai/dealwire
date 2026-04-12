import { Logger } from '@nestjs/common';
import type { MetricsService } from '../metrics/metrics.service';
import { getLlmContext, recordInAccumulator, setStage } from './llm-context';
import { priceUsd } from './llm-pricing';

const logger = new Logger('TrackedLlm');

/**
 * Module-level singleton holding the MetricsService instance, populated by
 * LlmObservabilityModule.onModuleInit. The tracked wrappers use this to
 * record metrics without needing Nest DI at every call site.
 */
let metricsSingleton: MetricsService | null = null;

export function __setLlmMetricsSingleton(m: MetricsService) {
  metricsSingleton = m;
}

export function __resetLlmMetricsSingleton() {
  metricsSingleton = null;
}

function detectProvider(modelId: string): 'openai' | 'anthropic' | 'unknown' {
  if (modelId.startsWith('gpt-')) return 'openai';
  if (modelId.startsWith('claude-')) return 'anthropic';
  return 'unknown';
}

function secondsFromStart(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e9;
}

/**
 * Shape extracted from a Vercel AI SDK result (generateObject, generateText).
 * Both expose `usage.promptTokens/completionTokens` and `response.modelId`
 * when the call succeeds.
 */
interface AiSdkLikeResult {
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  response?: {
    modelId?: string;
  };
}

/**
 * Run a Vercel AI SDK call (`generateObject`, `generateText`) inside a tracked
 * envelope. The thunk's return value must expose `usage` and `response.modelId`
 * (the standard AI SDK shape). On success we record tokens, cost, latency, and
 * update the run accumulator. On error we still record latency/status and
 * re-throw with the original stack.
 *
 * Usage:
 *   const { object } = await trackLlm('classification', () =>
 *     generateObject({ model: classifierModel(), schema, ... })
 *   );
 *
 * If `stage` is passed, it overrides the current context stage for this call.
 */
export async function trackLlm<R extends AiSdkLikeResult>(
  stage: string,
  fn: () => Promise<R>,
): Promise<R> {
  setStage(stage);
  const ctx = getLlmContext();
  const orgId = ctx?.organizationId;
  const start = process.hrtime.bigint();

  try {
    const result = await fn();
    const durationSeconds = secondsFromStart(start);
    const modelId = result.response?.modelId ?? 'unknown';
    const provider = detectProvider(modelId);
    const promptTokens = result.usage?.promptTokens ?? 0;
    const completionTokens = result.usage?.completionTokens ?? 0;
    const costUsd = priceUsd(modelId, promptTokens, completionTokens);

    metricsSingleton?.recordLlmCall({
      stage,
      model: modelId,
      provider,
      promptTokens,
      completionTokens,
      costUsd,
      durationSeconds,
      status: 'success',
      organizationId: orgId,
    });

    recordInAccumulator(stage, promptTokens, completionTokens, costUsd);

    return result;
  } catch (err) {
    const durationSeconds = secondsFromStart(start);
    metricsSingleton?.recordLlmCall({
      stage,
      model: 'unknown',
      provider: 'unknown',
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      durationSeconds,
      status: 'error',
      organizationId: orgId,
    });
    throw err;
  }
}

/**
 * Shape extracted from a raw OpenAI SDK ChatCompletion response.
 * Field names are snake_case (unlike AI SDK).
 */
interface OpenAiLikeResult {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}

/**
 * Run a raw OpenAI SDK chat completion call inside a tracked envelope.
 * Mirrors `trackLlm` but reads snake_case `usage` fields and `model` directly
 * from the OpenAI response.
 *
 * Usage:
 *   const response = await trackLlmOpenAI('deal_detection', () =>
 *     openai.chat.completions.create({ model, messages, ... })
 *   );
 */
export async function trackLlmOpenAI<R extends OpenAiLikeResult>(
  stage: string,
  fn: () => Promise<R>,
): Promise<R> {
  setStage(stage);
  const ctx = getLlmContext();
  const orgId = ctx?.organizationId;
  const start = process.hrtime.bigint();

  try {
    const result = await fn();
    const durationSeconds = secondsFromStart(start);
    const modelId = result.model ?? 'unknown';
    const provider = detectProvider(modelId);
    const promptTokens = result.usage?.prompt_tokens ?? 0;
    const completionTokens = result.usage?.completion_tokens ?? 0;
    const costUsd = priceUsd(modelId, promptTokens, completionTokens);

    metricsSingleton?.recordLlmCall({
      stage,
      model: modelId,
      provider,
      promptTokens,
      completionTokens,
      costUsd,
      durationSeconds,
      status: 'success',
      organizationId: orgId,
    });

    recordInAccumulator(stage, promptTokens, completionTokens, costUsd);

    return result;
  } catch (err) {
    const durationSeconds = secondsFromStart(start);
    metricsSingleton?.recordLlmCall({
      stage,
      model: 'unknown',
      provider: 'unknown',
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      durationSeconds,
      status: 'error',
      organizationId: orgId,
    });
    throw err;
  }
}

/**
 * Stream variant for `streamText`. AI SDK stream results expose `usage` as a
 * Promise that resolves after the stream completes. We return the stream
 * result synchronously so caller semantics are preserved; the recording
 * happens in a fire-and-forget microtask when the usage promise resolves.
 */
interface AiSdkStreamResult {
  usage?: Promise<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }>;
  response?: Promise<{ modelId?: string }>;
}

export function trackLlmStream<R extends AiSdkStreamResult>(
  stage: string,
  result: R,
): R {
  setStage(stage);
  const ctx = getLlmContext();
  const orgId = ctx?.organizationId;
  const start = process.hrtime.bigint();

  void Promise.all([result.usage, result.response])
    .then(([usage, response]) => {
      const durationSeconds = secondsFromStart(start);
      const modelId = response?.modelId ?? 'unknown';
      const provider = detectProvider(modelId);
      const promptTokens = usage?.promptTokens ?? 0;
      const completionTokens = usage?.completionTokens ?? 0;
      const costUsd = priceUsd(modelId, promptTokens, completionTokens);
      metricsSingleton?.recordLlmCall({
        stage,
        model: modelId,
        provider,
        promptTokens,
        completionTokens,
        costUsd,
        durationSeconds,
        status: 'success',
        organizationId: orgId,
      });
      recordInAccumulator(stage, promptTokens, completionTokens, costUsd);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `trackLlmStream: failed to read usage for stage="${stage}": ${msg}`,
      );
    });

  return result;
}
