import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DealSummaryService {
  private readonly logger = new Logger(DealSummaryService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(private readonly metricsService: MetricsService) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });

    this.logger.log(
      `OpenAI LLM initialized (model: ${this.aiConfig.openaiModel}, temperature: ${this.aiConfig.openaiTemperature})`,
    );
  }

  async summarizeDeal(
    extractedText: string,
    dealCriteria?: string,
  ): Promise<string> {
    const start = Date.now();
    try {
      // Build system prompt with optional client criteria
      let systemPrompt =
        'You are a real estate acquisitions analyst. ' +
        'You are analyzing OCR-extracted text from deal memos and images. The text may have formatting ' +
        'issues where labels and values are not on the same line, especially when extracted from images ' +
        'where labels and values may be vertically stacked. You must use context clues, proximity, and ' +
        'spatial relationships to match labels with their corresponding values. ' +
        '\n\n' +
        'IMPORTANT - Vertical Stacking: When text comes from images, labels and values are often ' +
        'vertically stacked (e.g., "Purchase Price" appears above "$3,500,000"). Look for patterns where ' +
        'a label appears directly above or below its value within 2-3 lines, even if separated by blank lines. ' +
        'For vertically stacked information, match labels with values that appear directly above or below them. ' +
        '\n\n' +
        'Examples of patterns to recognize:\n' +
        "- 'List Price' or 'Asking Price' or 'Purchase Price' on one line, with a dollar amount nearby (within a few lines)\n" +
        "- 'NOI' or 'Net Operating Income' followed by dollar amounts\n" +
        "- 'Cap Rate' or 'Cap' followed by percentages (like 6.9% or 6.82%)\n" +
        "- Financial metrics that appear in vertical layouts\n" +
        '\n' +
        'Return markdown format with clear sections. Focus on: Property Address, Purchase Price/Asking Price, ' +
        'NOI (T-12 and pro forma if available), Cap Rate (going-in and exit if available), Property Type/Class, ' +
        'Location/Market, Occupancy, Lease Terms, Key Value Drivers, and any red flags or concerns. ' +
        'Be brief and to the point - this is for initial deal screening. Use terms like NOI, cap rate, ' +
        'cash-on-cash, LTV, DSCR, stabilized NOI, rent roll, etc. Format with markdown headers (##) and ' +
        'bullet points (-).';

      if (dealCriteria) {
        systemPrompt +=
          '\n\nCLIENT-SPECIFIC CRITERIA: The client has the following deal preferences. ' +
          "After your summary, add a section called '## Fit Assessment' that evaluates " +
          `how well this deal matches their criteria:\n${dealCriteria}`;
      }

      const userPrompt =
        'Analyze this OCR-extracted deal memo text. The text may have formatting issues where ' +
        'labels and values are separated across lines, especially if extracted from images with ' +
        'vertically stacked layouts. Use context clues, proximity, and spatial relationships to ' +
        'match labels with their values.\n\n' +
        'Key patterns to recognize:\n' +
        "- If you see 'List Price', 'Asking Price', or 'Purchase Price' anywhere in the text, look for " +
        'nearby dollar amounts (especially large ones like $2,400,000 or $4,300,000). These may appear ' +
        'directly above or below the label, even if separated by blank lines.\n' +
        "- If you see 'NOI' or 'Net Operating Income', look for nearby dollar amounts (may be vertically stacked)\n" +
        "- If you see 'Cap Rate' or 'Cap', look for nearby percentages (like 6.9% or 6.82%)\n" +
        "- If you see 'Price Per Unit' or 'Price Per Square Foot', look for dollar amounts nearby\n" +
        '- If you see table structures, extract the data from tables\n' +
        '- Pay attention to section headers and group related information together\n' +
        '- For vertically stacked information, match labels with values that appear directly above or below them\n\n' +
        `Here is the extracted text:\n\n${extractedText}`;

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        user: 'deal-summary',
      });

      const summary = response.choices[0]?.message?.content || '';

      if (!summary) {
        throw new Error('Empty response from OpenAI');
      }

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('summary', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Deal summary generated (length: ${summary.length}, model: ${this.aiConfig.openaiModel})`,
      );

      return summary;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('summary', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Deal summarization failed: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to summarize deal: ${errorMessage}`);
    }
  }

  /**
   * Generate a short, conversational reply draft to send to the broker.
   * This is NOT the internal analysis — it's what the user would send to the broker
   * to express interest and move the conversation forward.
   */
  async generateBrokerReplyDraft(
    extractedText: string,
    decision: 'yes' | 'no',
    companyName?: string,
  ): Promise<string> {
    const start = Date.now();
    try {
      const systemPrompt = decision === 'yes'
        ? `You are drafting a brief, professional email reply from a real estate acquisitions team to a broker who sent a deal.
The team is interested in this deal. Write a short reply (2-4 sentences) that:
- Thanks them for sending the deal
- References the specific property or deal (use details from the text - address, property type, unit count, etc.)
- Expresses interest and suggests a next step (quick call, more info, OM request, etc.)
- Sounds natural and human — not overly formal or templated
${companyName ? `- The user works at ${companyName}` : ''}

Do NOT include a subject line. Do NOT include a greeting or sign-off (the email system handles threading). Just the body text.
Keep it concise — 2-4 sentences max.`
        : `You are drafting a brief, professional email reply from a real estate acquisitions team to a broker who sent a deal.
The team is NOT interested in this deal but wants to maintain the broker relationship. Write a short reply (2-3 sentences) that:
- Thanks them for thinking of the team
- Briefly explains it's not a fit right now (without being too specific about why)
- Encourages them to keep sending deals
${companyName ? `- The user works at ${companyName}` : ''}

Do NOT include a subject line. Do NOT include a greeting or sign-off. Just the body text.
Keep it concise — 2-3 sentences max.`;

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: 0.7, // Slightly more creative for natural-sounding replies
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Deal text:\n\n${extractedText.slice(0, 3000)}` },
        ],
        user: 'broker-reply-draft',
      });

      const draft = response.choices[0]?.message?.content || '';
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('broker-reply-draft', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(`Broker reply draft generated (decision: ${decision}, length: ${draft.length})`);
      return draft;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('broker-reply-draft', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Broker reply draft generation failed: ${errorMessage}`);
      throw new Error(`Failed to generate broker reply draft: ${errorMessage}`);
    }
  }
}

