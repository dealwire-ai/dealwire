import { Injectable } from '@nestjs/common';
import { generateObject, type CoreMessage, type LanguageModel } from 'ai';
import type { z } from 'zod';
import { trackLlm } from './tracked-llm';

export interface ModelStepOptions<T> {
  /** Stage label used for cost/token tracking and metrics. */
  stage: string;
  /** Vercel AI SDK model object (resolved via underwriting/model-config.ts). */
  model: LanguageModel;
  /** Zod schema the output must conform to. */
  schema: z.ZodSchema<T>;
  /** System prompt. */
  system: string;
  /** Conversation messages — typically a single user turn. */
  messages: CoreMessage[];
  /** SDK retry count on transient failures. Defaults to 2. */
  maxRetries?: number;
}

/**
 * Single chokepoint for structured LLM calls. Wraps Vercel AI SDK's
 * `generateObject` with `trackLlm` so cost, token, latency, and per-stage
 * accumulator tracking all live in one place. When we need to add OTel
 * spans, central rate-limit handling, or model-specific retry policies,
 * those go here — not in individual workflow services.
 */
@Injectable()
export class ModelGatewayService {
  async runStructured<T>(opts: ModelStepOptions<T>): Promise<T> {
    const { object } = await trackLlm(opts.stage, () =>
      generateObject({
        model: opts.model,
        schema: opts.schema,
        system: opts.system,
        messages: opts.messages,
        maxRetries: opts.maxRetries ?? 2,
      }),
    );
    return object;
  }
}
