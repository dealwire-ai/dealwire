import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';

@Injectable()
export class DealSummaryService {
  private readonly logger = new Logger(DealSummaryService.name);
  private readonly config = aiConfig();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
    });

    this.logger.log(
      `OpenAI LLM initialized (model: ${this.config.openaiModel}, temperature: ${this.config.openaiTemperature})`,
    );
  }

  async summarizeDeal(
    extractedText: string,
    dealCriteria?: string,
  ): Promise<string> {
    try {
      // Build system prompt with optional client criteria
      let systemPrompt =
        'You are a real estate acquisitions analyst for Hildreth Real Estate Advisors. ' +
        'You are analyzing OCR-extracted text from deal memos. The text may have formatting ' +
        'issues where labels and values are not on the same line. You must use context clues ' +
        'and proximity to match labels with their corresponding values. For example, if you see ' +
        "'List Price' on one line and '$2,400,000' nearby (within a few lines), match them " +
        'together. Look for patterns like: \'List Price\' or \'Asking Price\' followed by dollar ' +
        "amounts, 'NOI' or 'Net Operating Income' followed by dollar amounts, 'Cap Rate' followed " +
        'by percentages, etc. Return markdown format with clear sections. Focus on: Property ' +
        'Address, Purchase Price/Asking Price, NOI (T-12 and pro forma if available), Cap Rate ' +
        '(going-in and exit if available), Property Type/Class, Location/Market, Occupancy, ' +
        'Lease Terms, Key Value Drivers, and any red flags or concerns. Be brief and to the ' +
        'point - this is for initial deal screening. Use terms like NOI, cap rate, cash-on-cash, ' +
        'LTV, DSCR, stabilized NOI, rent roll, etc. Format with markdown headers (##) and ' +
        'bullet points (-).';

      if (dealCriteria) {
        systemPrompt +=
          '\n\nCLIENT-SPECIFIC CRITERIA: The client has the following deal preferences. ' +
          "After your summary, add a section called '## Fit Assessment' that evaluates " +
          `how well this deal matches their criteria:\n${dealCriteria}`;
      }

      const userPrompt =
        'Analyze this OCR-extracted deal memo text. The text may have formatting issues where ' +
        'labels and values are separated across lines. Use context clues, proximity, and common ' +
        'patterns to match labels with their values. For example:\n' +
        "- If you see 'List Price' or 'Asking Price' anywhere in the text, look for nearby dollar " +
        'amounts (especially large ones like $2,400,000 or $4,300,000)\n' +
        "- If you see 'NOI' or 'Net Operating Income', look for nearby dollar amounts\n" +
        "- If you see 'Cap Rate' or 'Cap', look for nearby percentages (like 6.9% or 6.82%)\n" +
        '- If you see table structures, extract the data from tables\n' +
        '- Pay attention to section headers and group related information together\n\n' +
        `Here is the extracted text:\n\n${extractedText}`;

      const response = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        temperature: this.config.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const summary = response.choices[0]?.message?.content || '';

      if (!summary) {
        throw new Error('Empty response from OpenAI');
      }

      this.logger.log(
        `Deal summary generated (length: ${summary.length}, model: ${this.config.openaiModel})`,
      );

      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Deal summarization failed: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to summarize deal: ${errorMessage}`);
    }
  }
}

