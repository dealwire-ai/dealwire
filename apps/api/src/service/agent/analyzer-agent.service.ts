import { Injectable, Logger } from '@nestjs/common';
import { generateText, streamText, CoreMessage, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { aiConfig } from '../../config/ai.config';

const SYSTEM_PROMPT = `You are a helpful assistant for a real estate investment platform. You help users query their deals, contacts (brokers), and properties/assets. You can also update their screening preferences.

IMPORTANT - Screening preferences (understand the difference):
1. **alwaysSkip**: Criteria for emails to NEVER process as deals. If an email matches alwaysSkip, we don't analyze it at all—no summary, no reply, no folder move. It stays in the inbox. Use for: "skip all emails from X", "ignore retail deals".
2. **dealCriteria**: Hard requirements for deal evaluation. Each deal is evaluated against these. If it fails → moved to "Passed Deals" folder. If it passes → stays in inbox with our analysis reply. Use for: "New York only", "minimum 5% cap rate", "no office".
3. **buyBox**: (Phase 2) Positive criteria for deals they want.

When updating preferences:
- update_always_skip: Sets what to skip entirely (not a deal).
- update_deal_criteria: Sets the evaluation criteria (YES/NO decision).
- update_passed_folder: Sets folder name for passed/rejected deals (default "Passed Deals").
- update_digest_schedule: Sets when digest emails are sent (cron + timezone).

Use the most specific tool for each question:
- For "who sent the most deals?" or ranking → get_top_contacts_by_deal_count
- For overall statistics → get_deal_stats
- For deals from a specific contact → get_deals_by_contact
- For deals in a location → get_deals_by_location
- Only use get_deals/get_contacts/get_assets for specific searches

Never fetch all data by paginating through everything. Use targeted queries.
Respond briefly and directly. No markdown formatting, plain text.`;

export interface AgentContext {
  organizationId: string;
  userId?: string;
}

@Injectable()
export class AnalyzerAgentService {
  private readonly logger = new Logger(AnalyzerAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly screeningPreferences: ScreeningPreferencesService,
  ) {}

  /**
   * Generate a response (non-streaming). Used for email replies.
   */
  async generate(
    context: AgentContext,
    userMessage: string,
  ): Promise<string> {
    const config = aiConfig();
    const tools = this.createTools(context);
    const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];

    const result = await generateText({
      model: openai(config.openaiModel),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 5,
    });

    return result.text || '';
  }

  /**
   * Stream a response. Used for web chat.
   */
  async stream(
    context: AgentContext,
    messages: CoreMessage[],
  ) {
    const config = aiConfig();
    const tools = this.createTools(context);

    return streamText({
      model: openai(config.openaiModel),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 5,
    });
  }

  private createTools(context: AgentContext) {
    const { organizationId } = context;
    if (!organizationId) {
      throw new Error('organizationId is required for agent tools');
    }

    const orgWhere = { organizationId };

    return {
      get_deal_stats: tool({
        description: 'Get aggregated statistics about deals (total count, yes/no decisions, etc.).',
        parameters: z.object({}),
        execute: async () => {
          const [total, yesCount, noCount] = await Promise.all([
            this.prisma.deal.count({ where: orgWhere }),
            this.prisma.deal.count({ where: { ...orgWhere, initialScreening: { decision: 'YES' } } }),
            this.prisma.deal.count({ where: { ...orgWhere, initialScreening: { decision: 'NO' } } }),
          ]);
          return { total, decisions: { yes: yesCount, no: noCount } };
        },
      }),

      get_top_contacts_by_deal_count: tool({
        description: 'Get contacts ranked by number of deals they sent. Use for "who sent the most deals?".',
        parameters: z.object({
          limit: z.number().optional().default(10).describe('Number of top contacts'),
        }),
        execute: async ({ limit = 10 }) => {
          const deals = await this.prisma.deal.findMany({
            where: orgWhere,
            select: { contactId: true },
          });
          const counts: Record<string, number> = {};
          for (const d of deals) {
            if (d.contactId) {
              counts[d.contactId] = (counts[d.contactId] || 0) + 1;
            }
          }
          const sorted = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit);
          const contactIds = sorted.map(([id]) => id);
          const contacts = await this.prisma.contact.findMany({
            where: { id: { in: contactIds } },
          });
          const contactMap = new Map(contacts.map((c) => [c.id, c]));
          return {
            topContacts: sorted.map(([id, count]) => ({
              contact: contactMap.get(id) || { id, email: 'Unknown' },
              dealCount: count,
            })),
            totalAnalyzed: deals.length,
          };
        },
      }),

      get_deals_by_contact: tool({
        description: 'Get all deals from a specific contact. Use contact email or name to search.',
        parameters: z.object({
          contactEmail: z.string().optional(),
          contactSearch: z.string().optional(),
          limit: z.number().optional().default(50),
        }),
        execute: async ({ contactEmail, contactSearch, limit = 50 }) => {
          let contactId: string | null = null;
          if (contactEmail) {
            const c = await this.prisma.contact.findFirst({
              where: {
                email: { equals: contactEmail, mode: 'insensitive' },
                deals: { some: orgWhere },
              },
            });
            contactId = c?.id ?? null;
          } else if (contactSearch) {
            const c = await this.prisma.contact.findFirst({
              where: {
                OR: [
                  { email: { contains: contactSearch, mode: 'insensitive' } },
                  { firstName: { contains: contactSearch, mode: 'insensitive' } },
                  { lastName: { contains: contactSearch, mode: 'insensitive' } },
                ],
                deals: { some: orgWhere },
              },
            });
            contactId = c?.id ?? null;
          }
          if (!contactId) return { error: 'Contact not found', deals: [] };
          const deals = await this.prisma.deal.findMany({
            where: { ...orgWhere, contactId },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { contact: true, initialScreening: true },
          });
          return { deals, contactId };
        },
      }),

      get_deals_by_location: tool({
        description: 'Get deals in a location (city, state, or address).',
        parameters: z.object({
          locationSearch: z.string(),
          limit: z.number().optional().default(50),
        }),
        execute: async ({ locationSearch, limit = 50 }) => {
          const assets = await this.prisma.asset.findMany({
            where: {
              OR: [
                { address: { contains: locationSearch, mode: 'insensitive' } },
                { city: { contains: locationSearch, mode: 'insensitive' } },
                { state: { contains: locationSearch, mode: 'insensitive' } },
                { normalizedAddress: { contains: locationSearch, mode: 'insensitive' } },
              ],
              deals: { some: orgWhere },
            },
            take: 50,
          });
          const assetIds = assets.map((a) => a.id);
          const deals = await this.prisma.deal.findMany({
            where: { ...orgWhere, assetId: { in: assetIds } },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { asset: true, initialScreening: true },
          });
          return { deals, matchingAssets: assets.length };
        },
      }),

      get_deals: tool({
        description: 'Search and list deals. Prefer more specific tools when possible.',
        parameters: z.object({
          search: z.string().optional(),
          decision: z.enum(['YES', 'NO']).optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, decision, page = 1, limit = 20 }) => {
          const where: Record<string, unknown> = { ...orgWhere };
          if (decision) {
            (where as any).initialScreening = { decision };
          }
          if (search) {
            (where as any).OR = [
              { sourceSubject: { contains: search, mode: 'insensitive' } },
              { sourceFrom: { contains: search, mode: 'insensitive' } },
            ];
          }
          const skip = (page - 1) * limit;
          const [deals, total] = await Promise.all([
            this.prisma.deal.findMany({
              where,
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
              include: { contact: true, initialScreening: true },
            }),
            this.prisma.deal.count({ where }),
          ]);
          return {
            deals,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          };
        },
      }),

      get_contacts: tool({
        description: 'Search and list contacts (brokers).',
        parameters: z.object({
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, page = 1, limit = 20 }) => {
          const where: Record<string, unknown> = { deals: { some: orgWhere } };
          if (search) {
            (where as any).OR = [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ];
          }
          const skip = (page - 1) * limit;
          const [contacts, total] = await Promise.all([
            this.prisma.contact.findMany({ where: where as any, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.contact.count({ where: where as any }),
          ]);
          return { contacts: contacts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
        },
      }),

      get_assets: tool({
        description: 'Search and list properties/assets.',
        parameters: z.object({
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, page = 1, limit = 20 }) => {
          const where: Record<string, unknown> = { deals: { some: orgWhere } };
          if (search) {
            (where as any).OR = [
              { address: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { state: { contains: search, mode: 'insensitive' } },
              { normalizedAddress: { contains: search, mode: 'insensitive' } },
            ];
          }
          const skip = (page - 1) * limit;
          const [assets, total] = await Promise.all([
            this.prisma.asset.findMany({ where: where as any, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.asset.count({ where: where as any }),
          ]);
          return { assets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
        },
      }),

      get_deal_details: tool({
        description: 'Get details for a specific deal by ID.',
        parameters: z.object({ dealId: z.string() }),
        execute: async ({ dealId }) => {
          const deal = await this.prisma.deal.findFirst({
            where: { id: dealId, ...orgWhere },
            include: { contact: true, asset: true, initialScreening: true, documents: true },
          });
          if (!deal) return { error: 'Deal not found' };
          return deal;
        },
      }),

      update_always_skip: tool({
        description: 'Update criteria for emails to always skip (not consider as deals). No analysis, no reply. Use when user says "skip X" or "ignore Y".',
        parameters: z.object({
          criteria: z.string().describe('The criteria to always skip (e.g. "retail deals", "emails from @broker.com")'),
        }),
        execute: async ({ criteria }) => {
          const updated = await this.screeningPreferences.updatePreferences(organizationId, { alwaysSkip: criteria });
          return { success: true, alwaysSkip: updated.alwaysSkip };
        },
      }),

      update_deal_criteria: tool({
        description: 'Update hard requirements for deal evaluation (YES/NO). Use when user specifies investment criteria like "New York only", "min 5% cap".',
        parameters: z.object({
          criteria: z.string().describe('The deal criteria for evaluation'),
        }),
        execute: async ({ criteria }) => {
          const updated = await this.screeningPreferences.updatePreferences(organizationId, { dealCriteria: criteria });
          return { success: true, dealCriteria: updated.dealCriteria };
        },
      }),

      update_passed_folder: tool({
        description: 'Update the folder name for passed/rejected deals (default "Passed Deals").',
        parameters: z.object({
          folderName: z.string().describe('Folder name for passed deals'),
        }),
        execute: async ({ folderName }) => {
          const updated = await this.screeningPreferences.updatePreferences(organizationId, {
            passedFolderName: folderName,
          });
          return { success: true, passedFolderName: updated.passedFolderName };
        },
      }),

      update_digest_schedule: tool({
        description: 'Update when digest emails are sent. Provide cron expression and timezone.',
        parameters: z.object({
          schedule: z.string().describe('CRON expression, e.g. "0 12 * * *" for daily noon'),
          timeZone: z.string().optional().default('America/New_York').describe('Timezone for the schedule'),
        }),
        execute: async ({ schedule, timeZone }) => {
          const updated = await this.screeningPreferences.updatePreferences(organizationId, {
            digestSchedule: schedule,
            digestTimeZone: timeZone,
          });
          return { success: true, digestSchedule: updated.digestSchedule, digestTimeZone: updated.digestTimeZone };
        },
      }),
    };
  }
}
