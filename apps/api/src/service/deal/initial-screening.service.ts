import { Injectable, Logger } from '@nestjs/common';
import { ScreeningBucket } from '@prisma/client';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { InitialScreeningResult } from '../../model/initial-screening.model';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressNormalizationService } from './address-normalization.service';
import { ContactNormalizationService } from './contact-normalization.service';

@Injectable()
export class InitialScreeningService {
  private readonly logger = new Logger(InitialScreeningService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prismaService: PrismaService,
    private readonly addressNormalizationService: AddressNormalizationService,
    private readonly contactNormalizationService: ContactNormalizationService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });
  }

  /**
   * Screen a deal and persist the result to the database.
   * Classifies the deal into one of the provided screening buckets.
   * @param dealId - The ID of the deal being screened
   * @param extractedText - Raw extracted text from email and attachments (may have formatting issues from OCR)
   * @param buckets - The org's screening buckets (ordered by rank)
   * @param senderEmail - Email address of the sender (for contact normalization)
   * @param senderName - Sender display name if available (for contact firstName/lastName)
   * @returns The screening result
   */
  async screen(
    dealId: string,
    extractedText: string,
    buckets: ScreeningBucket[],
    senderEmail?: string,
    senderName?: string,
  ): Promise<InitialScreeningResult> {
    const start = Date.now();
    try {
      const systemPrompt = this.buildPrompt(buckets);

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Raw Extracted Text:\n\n${extractedText}` },
        ],
        response_format: { type: 'json_object' },
        user: 'initial-screening',
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedContent = JSON.parse(content);

      // Match AI's returned bucket name to a ScreeningBucket record
      const matchedBucket = this.matchBucket(parsedContent.bucket, buckets);

      // Extract address components from AI response
      let assetId: string | null = null;
      if (parsedContent.address && typeof parsedContent.address === 'object') {
        try {
          assetId = await this.addressNormalizationService.findOrCreateAsset({
            street: parsedContent.address.street || undefined,
            city: parsedContent.address.city || undefined,
            state: parsedContent.address.state || undefined,
            country: parsedContent.address.country || undefined,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to process address for deal ${dealId}: ${errorMessage}. Continuing without asset association.`,
          );
        }
      }

      // Find or create contact from sender email (and optional display name)
      let contactId: string | null = null;
      if (senderEmail) {
        try {
          contactId = await this.contactNormalizationService.findOrCreateContact(
            senderEmail,
            senderName,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to process contact for deal ${dealId}: ${errorMessage}. Continuing without contact association.`,
          );
        }
      }

      // Derive decision from bucket's isPass flag
      const decision: 'yes' | 'no' = matchedBucket.isPass ? 'yes' : 'no';

      const result: InitialScreeningResult = {
        decision,
        reason: parsedContent.reason,
        assetId,
        contactId,
        bucketId: matchedBucket.id,
        bucketName: matchedBucket.name,
      };

      // Persist the screening result to the database
      await this.prismaService.initialScreening.upsert({
        where: { dealId },
        create: {
          dealId,
          decision: decision.toUpperCase() as 'YES' | 'NO',
          reason: result.reason,
          screeningBucketId: matchedBucket.id,
          screenedAt: new Date(),
        },
        update: {
          decision: decision.toUpperCase() as 'YES' | 'NO',
          reason: result.reason,
          screeningBucketId: matchedBucket.id,
          screenedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('initial-screening', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Initial screening completed: ${decision} bucket="${matchedBucket.name}" (model: ${this.aiConfig.openaiModel}) for deal ${dealId}${assetId ? ` with asset ${assetId}` : ' (no asset)'}${contactId ? ` with contact ${contactId}` : ' (no contact)'}`,
      );

      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('initial-screening', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Initial screening failed for deal ${dealId}: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to perform initial screening: ${errorMessage}`);
    }
  }

  private buildPrompt(buckets: ScreeningBucket[]): string {
    const bucketDescriptions = buckets
      .map(
        (b, i) =>
          `Bucket ${i + 1}: "${b.name}"\nCriteria: ${b.description}`,
      )
      .join('\n\n');

    return (
      'You are a real estate deal screener. Classify the deal into exactly one screening bucket.\n\n' +
      '=== IMPORTANT: THIS IS SCREENING, NOT UNDERWRITING ===\n' +
      '- Do NOT evaluate deal quality, financial viability, or investment metrics\n' +
      '- Do NOT reject deals for missing financial metrics, incomplete information, or subjective quality concerns\n' +
      '- ONLY check if the deal meets or violates the specific requirements listed in the buckets\n\n' +
      '=== SCREENING BUCKETS (evaluate in order) ===\n' +
      `${bucketDescriptions}\n\n` +
      '=== RULES ===\n' +
      '1. Evaluate buckets in rank order. Assign to the FIRST bucket whose criteria match.\n' +
      '2. The last bucket is the catch-all if no earlier bucket matches.\n' +
      '3. Be strict about geography and property requirements.\n' +
      '4. Missing Price Handling: If the purchase price is missing but you can infer deal size from units (e.g., 200-unit building), ' +
      'use typical price-per-unit ranges to estimate. Only reject for missing price if you cannot reasonably infer the deal meets minimum size requirements.\n\n' +
      '=== INPUT FORMAT ===\n' +
      'The text below is raw extracted text from emails and PDFs. It may have:\n' +
      '- OCR formatting issues\n' +
      '- Vertical stacking of text\n' +
      '- Missing or unclear labels\n\n' +
      'Use context clues and proximity to match labels with values. Look for information near related terms.\n\n' +
      '=== OUTPUT FORMAT ===\n' +
      'Respond with JSON in this exact format:\n' +
      '{"bucket": "<bucket name>", "reason": "your reason", "address": {"street": "123 Main St", "city": "New York", "state": "NY", "country": "USA"}}\n\n' +
      'The bucket field must be the exact name of one of the buckets above.\n\n' +
      'The reason should be:\n' +
      '- One sentence\n' +
      '- Written as if speaking directly to the client\n' +
      '- Cite which specific requirement was or was not met\n' +
      '- Be clear and specific\n\n' +
      'The address field should contain the property address if available. If no address is found or the deal is not about a specific property, set address to null. ' +
      'Extract the street address, city, state (use 2-letter abbreviation if possible), and country (default to "USA" if not specified).'
    );
  }

  /**
   * Match AI's returned bucket name to a ScreeningBucket record.
   * Case-insensitive match, falls back to last-ranked bucket if unrecognized.
   */
  private matchBucket(bucketName: string | undefined, buckets: ScreeningBucket[]): ScreeningBucket {
    if (bucketName) {
      const normalized = bucketName.toLowerCase().trim();
      const match = buckets.find((b) => b.name.toLowerCase().trim() === normalized);
      if (match) return match;

      this.logger.warn(
        `Unrecognized bucket name "${bucketName}" from AI, falling back to last-ranked bucket`,
      );
    }

    // Fall back to last-ranked bucket (catch-all)
    return buckets[buckets.length - 1];
  }
}
