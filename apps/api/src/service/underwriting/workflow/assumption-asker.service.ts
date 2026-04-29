import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { assumptionAskerModel } from '../model-config';
import { trackLlm } from '../../llm/tracked-llm';
import {
  AssumptionQuestion,
  AssumptionQuestionSchema,
  CANONICAL_ASSUMPTIONS,
} from './assumption-types';
import { DealAnalysis } from './workflow-types';
import { extractInputCells } from './workbook-serializer';

const SYSTEM_PROMPT = `You are preparing a single email asking a commercial real estate investor for the underwriting assumptions needed to run a pro forma on a specific deal.

You are given:
1. A canonical list of assumption questions (interest rate, LTV, exit cap, etc.) with default wording.
2. A summary of the extracted deal (property, pricing, income, expenses) — use this only to personalize hints, NEVER to invent values the user didn't provide.
3. The blue [input] cells from the investor's pro forma template (with nearby labels and current values) — this tells you which assumptions the template actually needs a value for.

Your task: return the ordered subset of canonical questions that are actually needed to fill this specific template for this specific deal. Rules:

- If the template has no blue input cell for a canonical field (e.g. no renovation budget cell), DROP that question.
- If the template already has a non-empty value in the input cell AND it looks like a reasonable default from the modeler (not stale deal data), you may still ask — the user's number overrides defaults.
- Preserve the canonical wording unless the template context strongly suggests a sharper hint (e.g. if the template shows an entry cap rate, the exit cap hint can reference it: "e.g. 6.5% — entry cap on this deal is 5.75%").
- Priority: "required" questions gate the pro forma. "recommended" questions have safe defaults if omitted — mark optional template fields as recommended.
- Return questions in the order the investor should answer them: required first, then recommended.
- Never add questions outside the canonical list. Never remove required questions unless the template clearly has no cell for them.`;

const OutputSchema = z.object({
  questions: z.array(AssumptionQuestionSchema),
});

@Injectable()
export class AssumptionAskerService {
  private readonly logger = new Logger(AssumptionAskerService.name);

  /**
   * Produce the assumption question list to email the investor, tailored to
   * the org's proforma template and the extracted deal. Always returns at
   * least the canonical required questions — the LLM may prune recommended
   * ones the template doesn't have cells for.
   */
  async generateQuestions(
    analysis: DealAnalysis,
    workbook: any,
    dealId: string,
  ): Promise<AssumptionQuestion[]> {
    const inputCellsText = extractInputCells(workbook);

    this.logger.log(
      `[${dealId}] Assumption asker: ${inputCellsText.length.toLocaleString()} chars of input-cell context`,
    );

    const canonicalJson = JSON.stringify(CANONICAL_ASSUMPTIONS, null, 2);
    const analysisSummary = summarizeAnalysis(analysis);

    try {
      const { object } = await trackLlm('workflow.assumption_ask', () =>
        generateObject({
          model: assumptionAskerModel(),
          schema: OutputSchema,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `## Canonical Assumptions\n\n\`\`\`json\n${canonicalJson}\n\`\`\`\n\n## Deal Summary\n\n${analysisSummary}\n\n## Proforma Input Cells\n\n${inputCellsText || '(no blue input cells detected)'}\n\nReturn the ordered subset of canonical questions the investor should answer to fill this proforma.`,
            },
          ],
          maxRetries: 2,
        }),
      );

      const pruned = ensureRequired(object.questions);
      this.logger.log(
        `[${dealId}] Assumption asker produced ${pruned.length}/${CANONICAL_ASSUMPTIONS.length} questions`,
      );
      return pruned;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${dealId}] Assumption asker failed, falling back to canonical list: ${msg}`,
      );
      return CANONICAL_ASSUMPTIONS;
    }
  }
}

/**
 * Guard against a model that accidentally drops a required canonical question.
 * If any required key is missing from the model's output, re-insert it in
 * its canonical position.
 */
function ensureRequired(
  modelOutput: AssumptionQuestion[],
): AssumptionQuestion[] {
  const byKey = new Map(modelOutput.map((q) => [q.key, q]));
  const result: AssumptionQuestion[] = [];
  for (const canon of CANONICAL_ASSUMPTIONS) {
    const fromModel = byKey.get(canon.key);
    if (fromModel) {
      result.push(fromModel);
      byKey.delete(canon.key);
    } else if (canon.priority === 'required') {
      result.push(canon);
    }
  }
  for (const extra of byKey.values()) result.push(extra);
  return result;
}

function summarizeAnalysis(analysis: DealAnalysis): string {
  const lines: string[] = [];
  if (analysis.propertyName) lines.push(`Property: ${analysis.propertyName}`);
  if (analysis.propertyAddress)
    lines.push(`Address: ${analysis.propertyAddress}`);
  if (analysis.totalUnits) lines.push(`Units: ${analysis.totalUnits}`);
  if (analysis.askingPrice)
    lines.push(`Asking: $${analysis.askingPrice.toLocaleString()}`);
  if (analysis.capRate != null)
    lines.push(`Entry cap rate: ${(analysis.capRate * 100).toFixed(2)}%`);
  if (analysis.noi) lines.push(`NOI: $${analysis.noi.toLocaleString()}`);
  if (analysis.occupancyRate != null)
    lines.push(`Occupancy: ${(analysis.occupancyRate * 100).toFixed(1)}%`);
  return lines.join('\n') || '(no deal summary available)';
}
