import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { DealDecision } from '../../model/deal-decision.model';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DealDecisionService {
  private readonly logger = new Logger(DealDecisionService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(private readonly metricsService: MetricsService) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });
  }

  async makeDecision(
    summary: string,
    dealCriteria?: string,
  ): Promise<DealDecision> {
    const start = Date.now();
    try {
      // Build prompt based on whether criteria is provided
      let systemPrompt: string;

      if (dealCriteria) {
        systemPrompt =
          'You are a real estate deal screener. Your ONLY job is to check if this deal ' +
          "meets the client's specific screening criteria. This is SCREENING, not underwriting - " +
          "do NOT evaluate deal quality, financial viability, or investment metrics.\n\n" +
          `CLIENT SCREENING CRITERIA (check ONLY these requirements):\n${dealCriteria}\n\n` +
          "Return 'yes' if the deal meets ALL of the client's criteria listed above. " +
          "Return 'no' ONLY if the deal clearly violates one or more of the client's criteria. " +
          "Do NOT reject deals for missing financial metrics, incomplete information, or subjective quality concerns - " +
          "those are not part of screening. Be strict about geography and property requirements - " +
          'a property in New Jersey does NOT satisfy a "New York only" requirement. ' +
          'Provide a one-sentence reason for your decision, citing which criterion was not met if applicable. ' +
          'Respond with JSON in the format: {"decision": "yes" or "no", "reason": "your reason"}.';
      } else {
        systemPrompt =
          'You are a real estate acquisitions analyst. Evaluate whether this is a ' +
          'good deal opportunity and make a yes/no decision. ' +
          "Return 'yes' if it's a good opportunity, 'no' otherwise. " +
          'Provide a one-sentence reason for your decision. ' +
          'Respond with JSON in the format: {"decision": "yes" or "no", "reason": "your reason"}.';
      }

      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Deal Summary:\n\n${summary}` },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedContent = JSON.parse(content);
      const decision: DealDecision = {
        decision: parsedContent.decision as 'yes' | 'no',
        reason: parsedContent.reason,
      };

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('decision', this.aiConfig.openaiModel, duration, 'success');

      this.logger.log(
        `Deal decision made: ${decision.decision} (model: ${this.aiConfig.openaiModel}) for deal criteria: ${dealCriteria}`,
      );

      return decision;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall('decision', this.aiConfig.openaiModel, duration, 'error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Deal decision failed: ${errorMessage} (type: ${errorType})`,
      );
      throw new Error(`Failed to make deal decision: ${errorMessage}`);
    }
  }
}

