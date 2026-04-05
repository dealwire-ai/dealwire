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
  return openai(name);
}

function resolveModelName(envVar: string, fallback: string): string {
  return process.env[envVar] || fallback;
}

// ── Underwriting pipeline (AI SDK model objects) ────────────────────

export function classifierModel() {
  return resolveModel('UW_CLASSIFIER_MODEL', 'gpt-4.1-nano');
}

export function extractorModel() {
  return resolveModel('UW_EXTRACTOR_MODEL', 'gpt-4.1');
}

/** Always defaults to Anthropic for PDF extraction (native file block support). */
export function pdfExtractorModel() {
  return resolveModel('UW_PDF_EXTRACTOR_MODEL', 'claude-sonnet-4-6');
}

export function mapperModel() {
  return resolveModel('UW_MAPPER_MODEL', 'gpt-4.1');
}

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

// ── Deal screening (raw model name strings for openai.chat.completions.create) ─

export function dealDetectionModelName(): string {
  return resolveModelName('DEAL_DETECTION_MODEL', 'gpt-4.1-nano');
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
