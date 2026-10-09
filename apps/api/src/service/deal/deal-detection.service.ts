import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { aiConfig } from '../../config/ai.config';
import { dealDetectionModelName } from '../underwriting/model-config';
import { PrismaService } from '../prisma/prisma.service';
import { trackLlmOpenAI } from '../llm/tracked-llm';

const DealDetectionSchema = z.object({
  isDeal: z
    .boolean()
    .describe('Whether this email is about a real estate deal offering'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Confidence level of the classification'),
  reason: z.string().describe('Brief reason for the classification'),
});

export type DealDetection = z.infer<typeof DealDetectionSchema>;

@Injectable()
export class DealDetectionService {
  private readonly logger = new Logger(DealDetectionService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
      maxRetries: 3,
    });
  }

  /**
   * Quickly determine if an email is about a real estate deal offering.
   * Uses structured output for fast, reliable classification.
   *
   * Three skip mechanisms, checked in order:
   * 1. skipKeywords: deterministic regex match on literal phrases ("NNN", "single tenant")
   * 2. knownProperties: deterministic regex match (property names/addresses the org already owns)
   * 3. skipCriteria: LLM-interpreted free-text rules (semantic criteria like "retail deals")
   */
  async isDealEmail(
    subject: string,
    bodyPreview: string,
    hasAttachments: boolean,
    userId?: string,
    organizationId?: string | null,
  ): Promise<DealDetection> {
    const modelName = dealDetectionModelName();
    try {
      // Load preferences if organizationId is provided
      let skipCriteria: string | null = null;
      let knownProperties: string | null = null;
      let skipKeywords: string | null = null;
      if (organizationId) {
        try {
          const prefs = await this.prisma.screeningPreferences.findUnique({
            where: { organizationId },
            select: {
              skipCriteria: true,
              knownProperties: true,
              skipKeywords: true,
            },
          });
          skipCriteria = prefs?.skipCriteria || null;
          knownProperties = prefs?.knownProperties || null;
          skipKeywords = prefs?.skipKeywords || null;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load preferences for org ${organizationId}: ${msg}`,
          );
        }
      }

      // Deterministic pre-checks: short-circuit before the LLM call.
      // The LLM only sees the subject + first 500 chars, so literal phrases
      // ("NNN", "single tenant") and known property names are matched by regex
      // here where they are guaranteed to be caught.
      const haystack = `${subject}\n${bodyPreview}`.toLowerCase();

      const matchedKeyword = this.findMatchingLine(
        skipKeywords,
        haystack,
        2,
        (line) => this.buildKeywordRegex(line),
      );
      if (matchedKeyword) {
        this.logger.log(
          `Deal detection: isDeal=false, confidence=high, reason="Matches skip keyword (deterministic): \\"${matchedKeyword}\\""`,
        );
        return {
          isDeal: false,
          confidence: 'high',
          reason: `Matches skip keyword: "${matchedKeyword}"`,
        };
      }

      // Each knownProperties line is a property name/address. We build a regex that
      // matches the core identifier with word boundaries, handling common
      // abbreviations (S/South, N/North, etc.).
      const matchedProperty = this.findMatchingLine(
        knownProperties,
        haystack,
        4,
        (line) => this.buildPropertyRegex(line),
      );
      if (matchedProperty) {
        this.logger.log(
          `Deal detection: isDeal=false, confidence=high, reason="Matches known property (deterministic): \\"${matchedProperty}\\""`,
        );
        return {
          isDeal: false,
          confidence: 'high',
          reason: `Matches known property: "${matchedProperty}"`,
        };
      }

      // Build system prompt
      let systemPrompt = `You are a classifier that determines if an email is about a real estate deal offering for a SPECIFIC PROPERTY or LOAN.
You must respond with valid JSON matching this schema: { "isDeal": boolean, "confidence": "high"|"medium"|"low", "reason": string }

CRITICAL: When uncertain or if the email is not clearly about a specific property/loan being offered, return isDeal: false.

Return isDeal: true ONLY if the email is:
- A broker blast or property offering with specific property details (address, location, property type, price)
- An offering memorandum (OM) or teaser for a specific property or loan
- Mentions specific property details: location, price, property type, address
- Contains indicators like: "OM", "Offering Memorandum", "Offering", "Just Listed", "Broker Blast"
- References data room, deal page, or property-specific materials for a specific property

Examples of IS A DEAL:
- "OM Posted // $188MM Nonperforming NYC Office Loan Sale / Premier Grand Central Submarket Location" (specific loan, location, price)
- "Just Listed | Hampton Inn & Suites - Portfolio" (broker blast, specific property, deal page mentioned)

Return isDeal: false if the email is:
- SaaS platforms, software services, CRM tools, dashboards, or technology platforms
- General business conversations or underwriting questions without a specific property being offered
- Service offerings (capital raising services, platforms, tools) - even if related to real estate
- Personal correspondence, meeting invites, calendar events
- Administrative emails or general market updates without a specific property
- Vague "investment opportunities" without specific property details
- Any email where you cannot identify a specific property or loan being marketed

Examples of NOT A DEAL:
- "Re: JK Equities & Raise Ai" - SaaS platform/service offering (Capital Advisory's platform, investor CRM, dashboards)
- "RE: JK Equities, LLC - 25-26 Pricing - Deductible options" - Just a chat about underwriting questions, no specific property

Consider attachments: PDFs may indicate deal memos or OMs, but only if the email content also mentions a specific property.`;

      // Add skipCriteria for LLM interpretation if configured
      if (skipCriteria && skipCriteria.trim()) {
        systemPrompt = `BEFORE classifying this email, check these SKIP CRITERIA. If ANY match, return isDeal: false immediately — do not evaluate deal quality.

Skip criteria:
${skipCriteria.trim()}

If the email matches any of the above criteria, return isDeal: false with a reason like "Matches skip criteria: <which criterion matched>". This takes precedence over all deal classification rules below.

---

${systemPrompt}`;
      }

      const response = await trackLlmOpenAI('deal_detection', () =>
        this.openai.chat.completions.create({
          model: modelName,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Subject: ${subject}

Body preview (first 500 chars):
${bodyPreview.slice(0, 500)}

Has attachments: ${hasAttachments ? 'Yes' : 'No'}`,
            },
          ],
          response_format: { type: 'json_object' },
          user: 'deal-detection',
        }),
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        this.logger.warn('No content from deal detection');
        return { isDeal: false, confidence: 'low', reason: 'No response' };
      }

      const result = DealDetectionSchema.safeParse(JSON.parse(content));
      if (!result.success) {
        this.logger.warn(
          `Invalid deal detection response: ${result.error.message}`,
        );
        return {
          isDeal: false,
          confidence: 'low',
          reason: 'Parse failed, defaulting to skip',
        };
      }

      const parsed = result.data;

      this.logger.log(
        `Deal detection: isDeal=${parsed.isDeal}, confidence=${parsed.confidence}, reason="${parsed.reason}"`,
      );

      return parsed;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Deal detection failed: ${msg}`);
      // Default to false on error - conservative approach to avoid false positives
      return {
        isDeal: false,
        confidence: 'low',
        reason: 'Detection failed, defaulting to skip',
      };
    }
  }

  /**
   * Split a newline-delimited preference list, strip bullet prefixes, drop
   * entries shorter than minLength, and return the first entry whose regex
   * matches the haystack (or null).
   */
  private findMatchingLine(
    list: string | null,
    haystack: string,
    minLength: number,
    buildRegex: (line: string) => RegExp | null,
  ): string | null {
    if (!list || !list.trim()) return null;
    const lines = list
      .split(/\n/)
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((line) => line.length >= minLength);
    for (const line of lines) {
      const pattern = buildRegex(line);
      if (pattern && pattern.test(haystack)) return line;
    }
    return null;
  }

  /**
   * Build a case-insensitive regex for a literal skip phrase. Whitespace and
   * hyphens are interchangeable so "single tenant" also matches "single-tenant".
   * A line wrapped in slashes (e.g. `/\b\d+[\s-]*keys?\b/`) is treated as a
   * raw regex; an invalid pattern is skipped rather than crashing detection.
   */
  private buildKeywordRegex(keyword: string): RegExp | null {
    const raw = keyword.match(/^\/(.+)\/[a-z]*$/);
    if (raw) {
      try {
        return new RegExp(raw[1], 'i');
      } catch {
        this.logger.warn(`Ignoring invalid skip keyword regex: ${keyword}`);
        return null;
      }
    }
    const parts = keyword
      .toLowerCase()
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (parts.length === 0) return null;
    return new RegExp(`\\b${parts.join('[\\s-]+')}\\b`, 'i');
  }

  /**
   * Build a case-insensitive regex for a property name/address that handles
   * common real estate abbreviations (S/South, N/North, Ave/Avenue, St/Street, etc.)
   * and matches with word boundaries so "1006 S Michigan" catches
   * "1006 South Michigan Avenue" but not "21006 Smith".
   */
  private buildPropertyRegex(property: string): RegExp {
    const abbreviations: Record<string, string> = {
      s: 's(?:outh)?',
      n: 'n(?:orth)?',
      e: 'e(?:ast)?',
      w: 'w(?:est)?',
      ave: 'ave(?:nue)?',
      st: 'st(?:reet)?',
      blvd: 'b(?:ou)?l(?:e)?v(?:ar)?d',
      dr: 'dr(?:ive)?',
      rd: 'r(?:oa)?d',
      pl: 'pl(?:ace)?',
      ct: 'c(?:our)?t',
      ln: 'l(?:a)?n(?:e)?',
    };

    const words = property.toLowerCase().split(/\s+/);
    const patternParts = words.map((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return abbreviations[word] || escaped;
    });

    return new RegExp(`\\b${patternParts.join('\\s+')}\\b`, 'i');
  }
}
