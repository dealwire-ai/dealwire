import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { DealType } from '../../model/extracted-data.model';
import { Prisma } from '@prisma/client';

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prismaService: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });
  }

  /**
   * Extract structured data from deal text and persist to the database.
   * @param dealId - The deal to update
   * @param extractedText - Combined text from email body and attachments
   */
  async extract(dealId: string, extractedText: string): Promise<void> {
    const start = Date.now();

    try {
      const systemPrompt =
        'You are a deal data extraction engine. Your job is to identify the deal type and extract structured fields from raw deal text.\n\n' +
        '=== DEAL TYPE ===\n' +
        'Identify the deal type from the text:\n' +
        '- "real_estate" — commercial or residential real estate acquisition (multifamily, office, retail, industrial, etc.)\n' +
        '- "debt" — debt/loan/note sale or financing opportunity\n' +
        '- "business" — business acquisition (restaurants, franchises, SaaS, etc.)\n' +
        '- "unknown" — cannot determine deal type\n\n' +
        '=== EXTRACTED FIELDS (for real_estate) ===\n' +
        'Extract the following fields. Return numbers as raw values (not formatted strings). Use decimals for rates and percentages (e.g., 6.5% cap rate = 0.065, 95% occupancy = 0.95). Return null for any field you cannot find.\n\n' +
        '- askingPrice: number or null — the listed/asking purchase price in dollars\n' +
        '- description: string or null — a one-sentence summary of the property\n' +
        '- propertyType: string or null — e.g. "multifamily", "office", "retail", "industrial", "mixed_use", "hotel", "self_storage", "mobile_home_park", "land"\n' +
        '- capRate: number or null — capitalization rate as decimal\n' +
        '- noi: number or null — net operating income in dollars\n' +
        '- occupancy: number or null — occupancy rate as decimal\n' +
        '- units: number or null — number of units (apartments, rooms, pads, etc.)\n' +
        '- squareFeet: number or null — total or rentable square footage\n' +
        '- yearBuilt: number or null — year the property was built\n' +
        '- pricePerUnit: number or null — price per unit in dollars\n' +
        '- pricePerSqFt: number or null — price per square foot in dollars\n\n' +
        '=== INPUT FORMAT ===\n' +
        'The text below is raw extracted text from emails and PDFs. It may have OCR formatting issues, vertical stacking of text, or missing/unclear labels. Use context clues and proximity to match labels with values.\n\n' +
        '=== OUTPUT FORMAT ===\n' +
        'Respond with JSON:\n' +
        '{"dealType": "real_estate"|"debt"|"business"|"unknown", "extractedData": { ...fields... }}\n\n' +
        'For non-real_estate deal types, still return extractedData as an empty object {} — we will add type-specific fields later.';

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Raw Extracted Text:\n\n${extractedText}` },
        ],
        response_format: { type: 'json_object' },
        user: 'data-extraction',
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const dealType: DealType = parsed.dealType || 'unknown';
      const extractedData = (parsed.extractedData || {}) as Prisma.InputJsonValue;

      await this.prismaService.deal.update({
        where: { id: dealId },
        data: { dealType, extractedData },
      });

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('data-extraction', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Data extraction completed for deal ${dealId}: type=${dealType} (${duration.toFixed(2)}s)`,
      );
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('data-extraction', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Data extraction failed for deal ${dealId}: ${errorMessage}`);
      throw error;
    }
  }
}
