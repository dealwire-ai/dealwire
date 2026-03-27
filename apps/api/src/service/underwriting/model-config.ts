import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Underwriting pipeline model configuration.
 *
 * Set UNDERWRITING_LLM_PROVIDER=openai to use OpenAI models,
 * defaults to anthropic.
 */
const provider = (
  process.env.UNDERWRITING_LLM_PROVIDER || 'anthropic'
).toLowerCase();

export function classifierModel() {
  return provider === 'openai'
    ? openai('gpt-4o-mini')
    : anthropic('claude-haiku-4-5-20251001');
}

export function extractorModel() {
  return provider === 'openai'
    ? openai('gpt-4o')
    : anthropic('claude-sonnet-4-6');
}

export function mapperModel() {
  return provider === 'openai'
    ? openai('gpt-4o')
    : anthropic('claude-sonnet-4-6');
}
