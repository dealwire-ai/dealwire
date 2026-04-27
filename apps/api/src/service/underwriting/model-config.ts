import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Centralized LLM model configuration.
 *
 * Every model slot has its own env var with a sensible default.
 * The helper auto-detects provider from model name prefix:
 *   claude-* → Anthropic, gpt-* → OpenAI
 */

function resolveModel(envVar: string, fallback: string) {
  const name = process.env[envVar] || fallback;
  if (name.startsWith('claude-')) return anthropic(name);
  if (name.startsWith('gpt-')) return openai(name);
  throw new Error(
    `Unknown model prefix for ${envVar}="${name}". Expected claude-* or gpt-*.`,
  );
}

function resolveModelName(envVar: string, fallback: string): string {
  return process.env[envVar] || fallback;
}

// ── Underwriting pipeline (AI SDK model objects) ────────────────────

export function analyzerModel() {
  return resolveModel('UW_ANALYZER_MODEL', 'claude-sonnet-4-6');
}

export function templateFillerModel() {
  return resolveModel('UW_TEMPLATE_FILLER_MODEL', 'claude-sonnet-4-6');
}

export function validatorModel() {
  return resolveModel('UW_VALIDATOR_MODEL', 'claude-sonnet-4-6');
}

export function proformaScanModel() {
  return resolveModel('UW_PROFORMA_SCAN_MODEL', 'claude-haiku-4-5-20251001');
}

export function assumptionAskerModel() {
  return resolveModel('UW_ASSUMPTION_ASKER_MODEL', 'claude-sonnet-4-6');
}

export function assumptionParserModel() {
  return resolveModel('UW_ASSUMPTION_PARSER_MODEL', 'gpt-4.1-mini');
}

export function replyRouterModel() {
  return resolveModel('UW_REPLY_ROUTER_MODEL', 'claude-sonnet-4-6');
}

// ── Deal screening (raw model name strings for openai.chat.completions.create) ─

export function dealDetectionModelName(): string {
  return resolveModelName('DEAL_DETECTION_MODEL', 'gpt-4.1-mini');
}

export function imageOcrModelName(): string {
  return resolveModelName('IMAGE_OCR_MODEL', 'gpt-4.1-mini');
}

export function dealGeneralModelName(): string {
  return resolveModelName('DEAL_GENERAL_MODEL', 'gpt-4.1-mini');
}

export function dealScreeningModelName(): string {
  return resolveModelName('DEAL_SCREENING_MODEL', 'gpt-4.1');
}
