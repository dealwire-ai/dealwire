import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { dealGeneralModelName } from '../underwriting/model-config';
import { DealDecision } from '../../model/deal-decision.model';
import { trackLlmOpenAI } from '../llm/tracked-llm';

@Injectable()
export class DealDecisionService {
  private readonly logger = new Logger(DealDecisionService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
      maxRetries: 3,
    });
  }

  /**
   * Make a decision on whether a deal meets the client's screening criteria
   * @param extractedText - Raw extracted text from email and attachments (may have formatting issues from OCR)
   * @param dealCriteria - The client's screening criteria
   * @returns The decision on whether the deal meets the client's screening criteria
   */
  async makeDecision(
    extractedText: string,
    dealCriteria?: string,
  ): Promise<DealDecision> {
    const modelName = dealGeneralModelName();
    try {
      // Build prompt based on whether criteria is provided
      let systemPrompt: string;

      if (dealCriteria) {
        systemPrompt =
          "You are a real estate deal screener. Your ONLY job is to check if deals meet the client's specific screening requirements.\n\n" +
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
          '{"decision": "yes" or "no", "reason": "your reason"}\n\n' +
          'The reason should be:\n' +
          '- One sentence\n' +
          '- Written as if speaking directly to the client\n' +
          '- Cite which specific requirement was not met (if "no")\n' +
          '- Be clear and specific';
      } else {
        systemPrompt =
          'You are a real estate acquisitions analyst. Evaluate whether this is a ' +
          'good deal opportunity and make a yes/no decision. ' +
          "Return 'yes' if it's a good opportunity, 'no' otherwise. " +
          '\n\nThe text below is raw extracted text from emails and PDFs (may have OCR formatting issues, vertical stacking, etc.). ' +
          'Use context clues and proximity to match labels with values. ' +
          'Provide a one-sentence reason for your decision. ' +
          'Respond with JSON in the format: {"decision": "yes" or "no", "reason": "your reason"}.';
      }

      const response = await trackLlmOpenAI('deal_decision', () =>
        this.openai.chat.completions.create({
          model: modelName,
          temperature: this.aiConfig.openaiTemperature,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Raw Extracted Text:\n\n${extractedText}`,
            },
          ],
          response_format: { type: 'json_object' },
          user: 'deal-decision',
        }),
      );

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedContent = JSON.parse(content);
      const decision: DealDecision = {
        decision: parsedContent.decision as 'yes' | 'no',
        reason: parsedContent.reason,
      };

      this.logger.log(
        `Deal decision made: ${decision.decision} (model: ${modelName}) for deal criteria: ${dealCriteria}`,
      );

      return decision;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType =
        error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Deal decision failed: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to make deal decision: ${errorMessage}`);
    }
  }
}
