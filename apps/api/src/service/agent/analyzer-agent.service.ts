import { Injectable, Logger } from '@nestjs/common';
import { generateText, streamText, CoreMessage, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { BrokerIntelligenceService } from '../deal/broker-intelligence.service';
import { aiConfig } from '../../config/ai.config';

const SYSTEM_PROMPT = `You are an AI acquisitions analyst for a real estate investment firm. You monitor their deal flow, track broker relationships, and help refine screening criteria. You communicate via email replies and web chat.

CORE CAPABILITIES:
1. Query deals, brokers, and properties
2. Provide broker intelligence (who sends what, pass rates, geographic focus)
3. Update screening preferences based on user feedback

SCREENING PREFERENCES (understand the difference):
- **alwaysSkip**: Criteria for emails to NEVER process. No analysis, no reply, no folder move. Use for: "skip all emails from X", "ignore retail deals", "don't process newsletters".
- **dealCriteria**: Hard requirements for YES/NO evaluation. Fails → moved to "Passed Deals" folder. Passes → stays in inbox with analysis. Use for: "New York only", "min 5% cap rate", "no office".
- **screening buckets**: Fine-grained classification tiers (Hot Deal, Good Fit, Pass, etc.) with customizable actions per bucket.

INTERPRETING USER FEEDBACK AS CRITERIA UPDATES:
When a user gives feedback about deals, interpret it as a criteria change:
- "Too big for us" or "we don't do deals this large" → update dealCriteria to add a size cap
- "Not interested in warehouse" or "skip warehouse deals" → update dealCriteria or alwaysSkip depending on severity
- "Actually this looks interesting" or "we'd consider this type" → suggest expanding criteria
- "Stop sending me deals like this" → update alwaysSkip
- "I don't care about ones from [broker]" → update alwaysSkip with sender filter

After any criteria update, ALWAYS confirm back what you changed and ask if the user wants to adjust further. Be specific about what changed.

TOOL SELECTION:
- Broker ranking/leaderboard → get_broker_leaderboard
- Detailed broker stats → get_broker_stats
- Deals from a specific broker → get_deals_by_contact
- Overall deal statistics → get_deal_stats
- Deals in a location → get_deals_by_location
- Generic deal/contact/asset search → get_deals/get_contacts/get_assets

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
    private readonly brokerIntelligence: BrokerIntelligenceService,
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

    // Load current preferences for context
    const prefs = await this.screeningPreferences.getPreferences(context.organizationId);
    const prefsContext = [
      prefs.dealCriteria ? `Current deal criteria: ${prefs.dealCriteria}` : null,
      prefs.alwaysSkip ? `Current always-skip rules: ${prefs.alwaysSkip}` : null,
    ].filter(Boolean).join('\n');
    const systemWithContext = prefsContext
      ? `${SYSTEM_PROMPT}\n\nCURRENT PREFERENCES:\n${prefsContext}`
      : SYSTEM_PROMPT;

    const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];

    const result = await generateText({
      model: openai(config.openaiModel),
      system: systemWithContext,
      messages,
      tools,
      maxSteps: 5,
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
            this.logger.log(`Tool call: ${call.toolName}(${JSON.stringify(call.args)})`);
          }
        }
        if (toolResults && toolResults.length > 0) {
          for (const res of toolResults) {
            const resultStr = JSON.stringify(res.result);
            const truncated = resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr;
            this.logger.log(`Tool result [${res.toolName}]: ${truncated}`);
          }
        }
      },
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

      get_broker_leaderboard: tool({
        description: 'Get brokers ranked by deal count with pass rates, geographic focus, and activity. Use for "who sent the most deals?", "top brokers", "broker leaderboard".',
        parameters: z.object({
          limit: z.number().optional().default(10).describe('Number of top brokers'),
          sortBy: z.enum(['dealCount', 'passRate']).optional().default('dealCount'),
          sinceDays: z.number().optional().describe('Only include deals from last N days'),
        }),
        execute: async ({ limit = 10, sortBy = 'dealCount', sinceDays }) => {
          const since = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : undefined;
          const leaderboard = await this.brokerIntelligence.getLeaderboard(organizationId, {
            limit,
            since,
            sortBy,
          });
          return {
            brokers: leaderboard.brokers.map((b) => ({
              name: [b.firstName, b.lastName].filter(Boolean).join(' ') || b.email,
              email: b.email,
              totalDeals: b.totalDeals,
              passRate: `${b.passRate}%`,
              yesCount: b.yesCount,
              noCount: b.noCount,
              topCities: b.topCities,
              lastDealAt: b.lastDealAt,
              avgDaysBetweenDeals: b.avgDaysBetweenDeals,
            })),
            totalBrokers: leaderboard.totalBrokers,
            totalDeals: leaderboard.totalDeals,
          };
        },
      }),

      get_broker_stats: tool({
        description: 'Get detailed stats for a specific broker. Use for "tell me about broker X", "what does [name] send?".',
        parameters: z.object({
          contactEmail: z.string().optional(),
          contactSearch: z.string().optional(),
        }),
        execute: async ({ contactEmail, contactSearch }) => {
          // Find contact
          let contact;
          if (contactEmail) {
            contact = await this.prisma.contact.findFirst({
              where: { email: { equals: contactEmail, mode: 'insensitive' }, deals: { some: orgWhere } },
            });
          } else if (contactSearch) {
            contact = await this.prisma.contact.findFirst({
              where: {
                OR: [
                  { email: { contains: contactSearch, mode: 'insensitive' } },
                  { firstName: { contains: contactSearch, mode: 'insensitive' } },
                  { lastName: { contains: contactSearch, mode: 'insensitive' } },
                ],
                deals: { some: orgWhere },
              },
            });
          }
          if (!contact) return { error: 'Broker not found' };

          const stats = await this.brokerIntelligence.getBrokerStats(contact.id, organizationId);
          if (!stats) return { error: 'No deals found for this broker' };

          return {
            name: [stats.firstName, stats.lastName].filter(Boolean).join(' ') || stats.email,
            email: stats.email,
            totalDeals: stats.totalDeals,
            passRate: `${stats.passRate}%`,
            yesCount: stats.yesCount,
            noCount: stats.noCount,
            topCities: stats.topCities,
            topStates: stats.topStates,
            firstDealAt: stats.firstDealAt,
            lastDealAt: stats.lastDealAt,
            avgDaysBetweenDeals: stats.avgDaysBetweenDeals,
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

      update_screening_bucket: tool({
        description: 'Update criteria for a specific screening bucket (e.g. "Hot Deal", "Good Fit", "Pass"). Use when user wants to refine what goes into a specific classification tier.',
        parameters: z.object({
          bucketName: z.string().describe('Name of the bucket to update (case-insensitive match)'),
          newDescription: z.string().describe('Updated criteria description for the bucket'),
        }),
        execute: async ({ bucketName, newDescription }) => {
          const bucket = await this.prisma.screeningBucket.findFirst({
            where: {
              organizationId,
              name: { equals: bucketName, mode: 'insensitive' },
            },
          });
          if (!bucket) {
            const allBuckets = await this.prisma.screeningBucket.findMany({
              where: { organizationId },
              select: { name: true },
              orderBy: { rank: 'asc' },
            });
            return {
              error: `Bucket "${bucketName}" not found. Available buckets: ${allBuckets.map((b) => b.name).join(', ')}`,
            };
          }
          const updated = await this.prisma.screeningBucket.update({
            where: { id: bucket.id },
            data: { description: newDescription },
          });
          return { success: true, bucket: updated.name, description: updated.description };
        },
      }),

      get_current_preferences: tool({
        description: 'Get the current screening preferences and bucket configuration. Use when user asks "what are my current criteria?" or before suggesting changes.',
        parameters: z.object({}),
        execute: async () => {
          const prefs = await this.screeningPreferences.getPreferences(organizationId);
          const buckets = await this.prisma.screeningBucket.findMany({
            where: { organizationId },
            orderBy: { rank: 'asc' },
            select: { name: true, description: true, rank: true, isPass: true, action: true },
          });
          return {
            dealCriteria: prefs.dealCriteria || 'Not set',
            alwaysSkip: prefs.alwaysSkip || 'Not set',
            passedFolderName: prefs.passedFolderName || 'Passed Deals',
            buckets: buckets.map((b) => ({
              name: b.name,
              criteria: b.description,
              decision: b.isPass ? 'YES' : 'NO',
              action: b.action,
            })),
          };
        },
      }),
    };
  }
}
