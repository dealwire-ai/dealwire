import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { aiConfig } from '../../config/ai.config';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

const DealDetectionSchema = z.object({
  isDeal: z.boolean().describe('Whether this email is about a real estate deal offering'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level of the classification'),
  reason: z.string().describe('Brief reason for the classification'),
});

export type DealDetection = z.infer<typeof DealDetectionSchema>;

@Injectable()
export class DealDetectionService {
  private readonly logger = new Logger(DealDetectionService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });
  }

  /**
   * Quickly determine if an email is about a real estate deal offering
   * Uses structured output for fast, reliable classification
   * Also checks alwaysSkip criteria if provided
   */
  async isDealEmail(
    subject: string,
    bodyPreview: string,
    hasAttachments: boolean,
    userId?: string,
    organizationId?: string | null,
  ): Promise<DealDetection> {
    const start = Date.now();
    try {
      // Load preferences if organizationId is provided
      let alwaysSkip: string | null = null;
      if (organizationId) {
        try {
          const prefs = await this.prisma.screeningPreferences.findUnique({
            where: { organizationId },
            select: { alwaysSkip: true },
          });
          alwaysSkip = prefs?.alwaysSkip || null;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to load preferences for org ${organizationId}: ${msg}`);
        }
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

      // Add alwaysSkip check if configured
      if (alwaysSkip && alwaysSkip.trim()) {
        systemPrompt += `\n\nCRITICAL SKIP RULE: If this email mentions, references, or is about "${alwaysSkip.trim()}", you MUST return isDeal: false with reason indicating it matches the alwaysSkip criteria (e.g., "Matches alwaysSkip criteria: ${alwaysSkip.trim()}"). This takes precedence over all other classification rules.`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // we should keep this as something fast and cheap for deal classification
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
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        const duration = (Date.now() - start) / 1000;
        this.metricsService.recordAICall('detection', 'gpt-4o-mini', duration, 'error');
        this.logger.warn('No content from deal detection');
        return { isDeal: false, confidence: 'low', reason: 'No response' };
      }

      const result = DealDetectionSchema.safeParse(JSON.parse(content));
      if (!result.success) {
        const duration = (Date.now() - start) / 1000;
        this.metricsService.recordAICall('detection', 'gpt-4o-mini', duration, 'error');
        this.logger.warn(`Invalid deal detection response: ${result.error.message}`);
        return { isDeal: false, confidence: 'low', reason: 'Parse failed, defaulting to skip' };
      }

      const parsed = result.data;
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('detection', 'gpt-4o-mini', duration, 'success');

      this.logger.log(
        `Deal detection: isDeal=${parsed.isDeal}, confidence=${parsed.confidence}, reason="${parsed.reason}"`,
      );

      return parsed;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('detection', 'gpt-4o-mini', duration, 'error');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Deal detection failed: ${msg}`);
      // Default to false on error - conservative approach to avoid false positives
      return { isDeal: false, confidence: 'low', reason: 'Detection failed, defaulting to skip' };
    }
  }
}

