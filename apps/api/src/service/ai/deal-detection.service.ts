import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { aiConfig } from '../../config/ai.config';

const DealDetectionSchema = z.object({
  isDeal: z.boolean().describe('Whether this email is about a real estate deal offering'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level of the classification'),
  reason: z.string().describe('Brief reason for the classification'),
});

type DealDetection = z.infer<typeof DealDetectionSchema>;

@Injectable()
export class DealDetectionService {
  private readonly logger = new Logger(DealDetectionService.name);
  private readonly config = aiConfig();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
    });
  }

  /**
   * Quickly determine if an email is about a real estate deal offering
   * Uses structured output for fast, reliable classification
   */
  async isDealEmail(
    subject: string,
    bodyPreview: string,
    hasAttachments: boolean,
  ): Promise<DealDetection> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cheap for classification
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are a classifier that determines if an email is about a real estate deal offering.
You must respond with valid JSON matching this schema: { "isDeal": boolean, "confidence": "high"|"medium"|"low", "reason": string }

Return isDeal: true if the email is:
- A teaser or offering memorandum (OM) for a property
- An investment opportunity for real estate acquisition
- A property listing or deal opportunity
- A forward of any of the above

Return isDeal: false if the email is:
- Personal correspondence
- Newsletters or marketing not about a specific deal
- Meeting invites, calendar events
- Administrative emails
- General market updates without a specific property

Consider attachments: PDFs often indicate deal memos or OMs.`,
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
        this.logger.warn('No content from deal detection');
        return { isDeal: false, confidence: 'low', reason: 'No response' };
      }

      const result = DealDetectionSchema.safeParse(JSON.parse(content));
      if (!result.success) {
        this.logger.warn(`Invalid deal detection response: ${result.error.message}`);
        return { isDeal: true, confidence: 'low', reason: 'Parse failed, defaulting to process' };
      }

      const parsed = result.data;

      this.logger.log(
        `Deal detection: isDeal=${parsed.isDeal}, confidence=${parsed.confidence}, reason="${parsed.reason}"`,
      );

      return parsed;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Deal detection failed: ${msg}`);
      // Default to true on error so we don't miss deals
      return { isDeal: true, confidence: 'low', reason: 'Detection failed, defaulting to process' };
    }
  }
}

