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
      maxRetries: 3,
    });

    this.logger.log(
      `OpenAI LLM initialized (model: ${this.aiConfig.openaiModel}, temperature: ${this.aiConfig.openaiTemperature})`,
    );
  }

  /**
   * Generate a short, conversational reply draft to send to the broker.
   * This is NOT the internal analysis — it's what the user would send to the broker
   * to express interest and move the conversation forward.
   *
   * When broker context is provided, the draft references past relationship history.
   * When extracted data is provided, the draft asks smart follow-up questions about missing info.
   */
  async generateBrokerReplyDraft(
    extractedText: string,
    decision: 'yes' | 'no',
    companyName?: string,
    brokerContext?: {
      name: string;
      totalDeals: number;
      passRate: number;
      topCities: Array<{ city: string; count: number }>;
      recentPassingDeals?: string[];
      notes?: string;
    },
    extractedData?: Record<string, unknown>,
  ): Promise<string> {
    const start = Date.now();
    try {
      // Build relationship context for the prompt
      let relationshipContext = '';
      if (brokerContext && brokerContext.totalDeals > 1) {
        relationshipContext = `\n\nBROKER RELATIONSHIP CONTEXT (use subtly — don't list stats, just sound like you know them):
- This broker has sent ${brokerContext.totalDeals} deals previously`;
        if (brokerContext.recentPassingDeals && brokerContext.recentPassingDeals.length > 0) {
          relationshipContext += `\n- Recent deals from them you liked: ${brokerContext.recentPassingDeals.slice(0, 3).join(', ')}`;
        }
        if (brokerContext.notes) {
          relationshipContext += `\n- Personal notes: ${brokerContext.notes}`;
        }
      }

      // Detect missing info to ask smart follow-up questions
      let missingDataContext = '';
      if (decision === 'yes' && extractedData) {
        const missing: string[] = [];
        if (!extractedData.noi) missing.push('T-12 or current NOI');
        if (!extractedData.occupancy) missing.push('current occupancy');
        if (!extractedData.askingPrice) missing.push('asking price or guidance');
        if (!extractedData.units && !extractedData.squareFeet) missing.push('unit count or square footage');
        if (missing.length > 0) {
          missingDataContext = `\n\nMISSING INFORMATION (naturally ask about 1-2 of these — don't list them all):
${missing.join(', ')}`;
        }
      }

      const systemPrompt = decision === 'yes'
        ? `You are drafting a brief, professional email reply from a real estate acquisitions team to a broker who sent a deal.
The team is interested in this deal. Write a short reply (2-4 sentences) that:
- Thanks them for sending the deal
- References the specific property or deal (use details from the text - address, property type, unit count, etc.)
- Expresses interest and suggests a next step (quick call, more info, OM request, etc.)
- If there's missing information, naturally ask about 1-2 key items
- Sounds natural and human — not overly formal or templated
- If you have relationship context, reference it naturally (e.g., "appreciate you continuing to think of us" or mention a past deal)
${companyName ? `- The user works at ${companyName}` : ''}${relationshipContext}${missingDataContext}

Do NOT include a subject line. Do NOT include a greeting or sign-off (the email system handles threading). Just the body text.
Keep it concise — 2-4 sentences max.`
        : `You are drafting a brief, professional email reply from a real estate acquisitions team to a broker who sent a deal.
The team is NOT interested in this deal but wants to maintain the broker relationship. Write a short reply (2-3 sentences) that:
- Thanks them for thinking of the team
- Briefly explains it's not a fit right now (without being too specific about why)
- Encourages them to keep sending deals
- If you have relationship context, be warm and reference the ongoing relationship
${companyName ? `- The user works at ${companyName}` : ''}${relationshipContext}

Do NOT include a subject line. Do NOT include a greeting or sign-off. Just the body text.
Keep it concise — 2-3 sentences max.`;

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Deal text:\n\n${extractedText.slice(0, 3000)}` },
        ],
        user: 'broker-reply-draft',
      });

      const draft = response.choices[0]?.message?.content || '';
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('broker-reply-draft', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(`Broker reply draft generated (decision: ${decision}, length: ${draft.length}, hasContext: ${!!brokerContext})`);
      return draft;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('broker-reply-draft', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Broker reply draft generation failed: ${errorMessage}`);
      throw new Error(`Failed to generate broker reply draft: ${errorMessage}`);
    }
  }

  /**
   * Generate both a structured summary and a conversational narrative in a single OpenAI call.
   * Saves ~50% of tokens vs calling summarizeDeal + generateDealNarrative separately.
   */
  async summarizeDealWithNarrative(
    extractedText: string,
    dealCriteria?: string,
    structuredData?: Record<string, unknown>,
  ): Promise<{ summary: string; narrative: string }> {
    const start = Date.now();
    try {
      let systemPrompt =
        'You are a real estate acquisitions analyst. ' +
        'You are analyzing OCR-extracted text from deal memos and images. The text may have formatting ' +
        'issues where labels and values are not on the same line, especially when extracted from images ' +
        'where labels and values may be vertically stacked. You must use context clues, proximity, and ' +
        'spatial relationships to match labels with their corresponding values. ' +
        '\n\n' +
        'You will produce TWO outputs in a single JSON response:\n\n' +
        '1. **summary**: A markdown-formatted deal summary with clear sections. Focus on: Property Address, ' +
        'Purchase Price/Asking Price, NOI (T-12 and pro forma if available), Cap Rate (going-in and exit if available), ' +
        'Property Type/Class, Location/Market, Occupancy, Lease Terms, Key Value Drivers, and any red flags or concerns. ' +
        'Be brief and to the point - this is for initial deal screening. Use terms like NOI, cap rate, ' +
        'cash-on-cash, LTV, DSCR, stabilized NOI, rent roll, etc. Format with markdown headers (##) and bullet points (-).\n\n' +
        '2. **narrative**: A 3-5 sentence conversational narrative that tells the story of this deal. Cover why it is being sold ' +
        '(if apparent), what the property is, the investment angle/thesis, and any noteworthy details. ' +
        'Write it like what you would say out loud on a broker call — NOT bullet points, NOT a list. ' +
        'Plain text, no markdown. If something is not in the text, do not speculate.\n\n' +
        'IMPORTANT - Vertical Stacking: When text comes from images, labels and values are often ' +
        'vertically stacked (e.g., "Purchase Price" appears above "$3,500,000"). Look for patterns where ' +
        'a label appears directly above or below its value within 2-3 lines.\n\n' +
        'Return ONLY valid JSON with exactly two keys: "summary" and "narrative". No markdown code fences.';

      if (dealCriteria) {
        systemPrompt +=
          '\n\nCLIENT-SPECIFIC CRITERIA: The client has the following deal preferences. ' +
          "In the summary, add a section called '## Fit Assessment' that evaluates " +
          `how well this deal matches their criteria:\n${dealCriteria}`;
      }

      let userPrompt =
        'Analyze this deal and produce both a structured summary and conversational narrative.\n\n';

      if (structuredData) {
        userPrompt += `Structured data already extracted from the deal (use as primary source for numbers):\n${JSON.stringify(structuredData, null, 2)}\n\n`;
      }

      userPrompt += `Extracted text:\n\n${extractedText}`;

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        user: 'summary-and-narrative',
      });

      const content = response.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content) as { summary?: string; narrative?: string };
      const summary = parsed.summary || '';
      const narrative = parsed.narrative || '';

      if (!summary) {
        throw new Error('Missing summary in OpenAI response');
      }

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('summary-and-narrative', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Deal summary+narrative generated (summary: ${summary.length}, narrative: ${narrative.length}, model: ${this.aiConfig.openaiModel})`,
      );

      return { summary, narrative };
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('summary-and-narrative', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Deal summary+narrative failed: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to generate deal summary+narrative: ${errorMessage}`);
    }
  }

}

