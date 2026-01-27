import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { InitialScreeningResult } from '../../model/initial-screening.model';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressNormalizationService } from './address-normalization.service';

@Injectable()
export class InitialScreeningService {
  private readonly logger = new Logger(InitialScreeningService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prismaService: PrismaService,
    private readonly addressNormalizationService: AddressNormalizationService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });
  }

  /**
   * Screen a deal and persist the result to the database
   * @param dealId - The ID of the deal being screened
   * @param extractedText - Raw extracted text from email and attachments (may have formatting issues from OCR)
   * @param dealCriteria - The client's screening criteria
   * @returns The screening result
   */
  async screen(
    dealId: string,
    extractedText: string,
    dealCriteria?: string,
  ): Promise<InitialScreeningResult> {
    const start = Date.now();
    try {
      // Build prompt based on whether criteria is provided
      let systemPrompt: string;

      if (dealCriteria) {
        systemPrompt =
          'You are a real estate deal screener. Your ONLY job is to check if deals meet the client\'s specific screening requirements.\n\n' +
          '=== IMPORTANT: THIS IS SCREENING, NOT UNDERWRITING ===\n' +
          '- Do NOT evaluate deal quality, financial viability, or investment metrics\n' +
          '- Do NOT reject deals for missing financial metrics, incomplete information, or subjective quality concerns\n' +
          '- ONLY check if the deal meets or violates the specific requirements listed below\n\n' +
          '=== CLIENT SCREENING REQUIREMENTS ===\n' +
          'These are the ONLY criteria you should evaluate. Check each requirement carefully:\n\n' +
          `${dealCriteria}\n\n` +
          '=== DECISION RULES ===\n' +
          '1. Return "yes" ONLY if the deal meets ALL requirements listed above\n' +
          '2. Return "no" if the deal clearly violates one or more requirements\n' +
          '3. Be strict about geography and property requirements \n' +
          '4. Missing Price Handling: If the purchase price is missing but you can infer deal size from units (e.g., 200-unit building), ' +
          'use typical price-per-unit ranges to estimate. Only reject for missing price if you cannot reasonably infer the deal meets minimum size requirements\n\n' +
          '=== INPUT FORMAT ===\n' +
          'The text below is raw extracted text from emails and PDFs. It may have:\n' +
          '- OCR formatting issues\n' +
          '- Vertical stacking of text\n' +
          '- Missing or unclear labels\n\n' +
          'Use context clues and proximity to match labels with values. Look for information near related terms.\n\n' +
          '=== OUTPUT FORMAT ===\n' +
          'Respond with JSON in this exact format:\n' +
          '{"decision": "yes" or "no", "reason": "your reason", "address": {"street": "123 Main St", "city": "New York", "state": "NY", "country": "USA"}}\n\n' +
          'The reason should be:\n' +
          '- One sentence\n' +
          '- Written as if speaking directly to the client\n' +
          '- Cite which specific requirement was not met (if "no")\n' +
          '- Be clear and specific\n\n' +
          'The address field should contain the property address if available. If no address is found or the deal is not about a specific property, set address to null. ' +
          'Extract the street address, city, state (use 2-letter abbreviation if possible), and country (default to "USA" if not specified).';
      } else {
        systemPrompt =
          'You are a real estate acquisitions analyst. Evaluate whether this is a ' +
          'good deal opportunity and make a yes/no decision. ' +
          "Return 'yes' if it's a good opportunity, 'no' otherwise. " +
          '\n\nThe text below is raw extracted text from emails and PDFs (may have OCR formatting issues, vertical stacking, etc.). ' +
          'Use context clues and proximity to match labels with values. ' +
          'Provide a one-sentence reason for your decision. ' +
          'Also extract the property address if available. ' +
          'Respond with JSON in the format: {"decision": "yes" or "no", "reason": "your reason", "address": {"street": "123 Main St", "city": "New York", "state": "NY", "country": "USA"}}. ' +
          'If no address is found or the deal is not about a specific property, set address to null. ' +
          'Extract the street address, city, state (use 2-letter abbreviation if possible), and country (default to "USA" if not specified).';
      }

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
          // Continue without asset - don't fail the screening
        }
      }

      const result: InitialScreeningResult = {
        decision: parsedContent.decision as 'yes' | 'no',
        reason: parsedContent.reason,
        assetId,
      };

      // Persist the screening result to the database
      await this.prismaService.initialScreening.upsert({
        where: { dealId },
        create: {
          dealId,
          decision: result.decision.toUpperCase() as 'YES' | 'NO',
          reason: result.reason,
          screenedAt: new Date(),
        },
        update: {
          decision: result.decision.toUpperCase() as 'YES' | 'NO',
          reason: result.reason,
          screenedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('initial-screening', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Initial screening completed: ${result.decision} (model: ${this.aiConfig.openaiModel}) for deal ${dealId}${assetId ? ` with asset ${assetId}` : ' (no asset)'}`,
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
}
