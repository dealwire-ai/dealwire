import { Injectable, Logger } from '@nestjs/common';
import { generateText, streamText, CoreMessage, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { BrokerIntelligenceService } from '../deal/broker-intelligence.service';
import { ParcelQueryService } from '../public-data/parcel-query.service';
import { PropertyListService } from '../public-data/property-list.service';
import { PhoneNoteService } from '../public-data/phone-note.service';
import { dealGeneralModelName } from '../underwriting/model-config';
import { BOROUGH_NAMES } from '../public-data/nyc-utils';
import { ParcelListType, PhoneStatus } from '@prisma/client';
import { trackLlm, trackLlmStream } from '../llm/tracked-llm';

const SYSTEM_PROMPT = `You are an AI acquisitions analyst for a real estate investment firm. You monitor their deal flow, track broker relationships, and help refine screening criteria. You communicate via email replies and web chat.

CORE CAPABILITIES:
1. Query deals, brokers, and properties
2. Provide broker intelligence (who sends what, pass rates, geographic focus)
3. Update screening preferences based on user feedback

SCREENING PREFERENCES (understand the difference):
- **skipCriteria**: Free-text criteria for emails to NEVER process. No analysis, no reply, no folder move. Use for: "skip retail deals", "ignore deals under 40 units", "don't process newsletters". Interpreted by the LLM.
- **knownProperties**: List of property names/addresses the org already owns or has invested in. Matched deterministically via regex — any email about these properties is auto-skipped. Use for: "we own 1006 S Michigan", "add Bryant Plaza to known properties".
- **dealCriteria**: Hard requirements for YES/NO evaluation. Fails → moved to "Passed Deals" folder. Passes → stays in inbox with analysis. Use for: "New York only", "min 5% cap rate", "no office".
- **screening buckets**: Fine-grained classification tiers (Hot Deal, Good Fit, Pass, etc.) with customizable actions per bucket.

INTERPRETING USER FEEDBACK AS CRITERIA UPDATES:
When a user gives feedback about deals, interpret it as a criteria change:
- "Too big for us" or "we don't do deals this large" → update dealCriteria to add a size cap
- "Not interested in warehouse" or "skip warehouse deals" → update dealCriteria or skipCriteria depending on severity
- "Actually this looks interesting" or "we'd consider this type" → suggest expanding criteria
- "Stop sending me deals like this" → update skipCriteria
- "I don't care about ones from [broker]" → update skipCriteria with sender filter
- "We own [property]" / "that's our building" / "already invested in [property]" → update knownProperties
- "I already passed on this" / "mute this deal" / "don't show this again" → mute_deal

After any criteria update, ALWAYS confirm back what you changed and ask if the user wants to adjust further. Be specific about what changed.

BROKER NOTES:
- Users can save personal notes about brokers ("just had a baby", "likes the Knicks", "always responsive")
- Use update_contact_notes to save notes, get_contact_notes to retrieve them
- Use update_contact_tags to categorize brokers ("top broker", "responsive", "multifamily specialist")

TOOL SELECTION:
- Broker ranking/leaderboard → get_broker_leaderboard
- Detailed broker stats → get_broker_stats
- Deals from a specific broker → get_deals_by_contact
- Overall deal statistics → get_deal_stats
- Deals in a location → get_deals_by_location
- Broker notes/tags → update_contact_notes/get_contact_notes/update_contact_tags
- Generic deal/contact/asset search → get_deals/get_contacts/get_assets
- Mute a specific deal (suppress future follow-ups) → mute_deal

PUBLIC DATA (NYC PARCELS):
- Search distressed parcels → query_parcels (filter by borough, score, liens, tax bills, zip code, building class, list type, address)
- Get full detail on one parcel → get_parcel_details (by BBL)
- Aggregate parcel stats → get_parcel_stats (counts, avg scores, debt totals, by borough)
- View parcels on a triage list → get_parcels_by_list (IMMEDIATE, LONG_TERM, NOT_INTERESTED)
- Assign parcel to triage list → assign_parcel_list (or remove from list with null)
- Get phone notes for a parcel → get_parcel_phone_notes
- Add/update phone note → update_parcel_phone_note (record call outcomes)
- Parcels are public property records identified by BBL (10-digit: 1 borough + 5 block + 4 lot)
- Enriched with PLUTO building data, HPD violations, DOF tax charges, NYCTL lien sale data
- Borough codes: 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island
- Building class groups: residential (A/B/C), commercial (E-Z), walkup (C1-C7)
- List types: IMMEDIATE (hot leads), LONG_TERM (monitor), NOT_INTERESTED (pass)

TOOL SELECTION — PARCELS:
- "Show me distressed parcels in Brooklyn" → query_parcels
- "Tell me about BBL 3012340001" → get_parcel_details
- "How many parcels have liens?" → get_parcel_stats
- "Show my immediate list" → get_parcels_by_list
- "Add this to my immediate list" → assign_parcel_list
- "Have we called the owner?" → get_parcel_phone_notes
- "I called the owner, number was bad" → update_parcel_phone_note
- "Parcels with tax bills over $50k" → query_parcels with minOutstandingTaxBill
- "Parcels in zip 11201 with liens" → query_parcels with zipCode + hasActiveLien

Never fetch all data by paginating through everything. Use targeted queries.
Respond briefly and directly. No markdown formatting, plain text.`;

export interface AgentContext {
  organizationId: string;
  userId?: string;
}

@Injectable()
export class DealwireAgentService {
  private readonly logger = new Logger(DealwireAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly screeningPreferences: ScreeningPreferencesService,
    private readonly brokerIntelligence: BrokerIntelligenceService,
    private readonly parcelQuery: ParcelQueryService,
    private readonly propertyList: PropertyListService,
    private readonly phoneNote: PhoneNoteService,
  ) {}

  /**
   * Generate a response (non-streaming). Used for email replies.
   */
  async generate(context: AgentContext, userMessage: string): Promise<string> {
    const tools = this.createTools(context);

    // Load current preferences for context
    const prefs = await this.screeningPreferences.getPreferences(
      context.organizationId,
    );
    const prefsContext = [
      prefs.dealCriteria
        ? `Current deal criteria: ${prefs.dealCriteria}`
        : null,
      prefs.skipCriteria
        ? `Current skip criteria: ${prefs.skipCriteria}`
        : null,
      prefs.knownProperties
        ? `Current known properties: ${prefs.knownProperties}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
    const systemWithContext = prefsContext
      ? `${SYSTEM_PROMPT}\n\nCURRENT PREFERENCES:\n${prefsContext}`
      : SYSTEM_PROMPT;

    const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];

    const result = await trackLlm('chat_agent', () =>
      generateText({
        model: openai(dealGeneralModelName()),
        system: systemWithContext,
        messages,
        tools,
        maxSteps: 5,
        onStepFinish: ({ toolCalls, toolResults }) => {
          if (toolCalls && toolCalls.length > 0) {
            for (const call of toolCalls) {
              this.logger.log(
                `Tool call: ${call.toolName}(${JSON.stringify(call.args)})`,
              );
            }
          }
          if (toolResults && toolResults.length > 0) {
            for (const res of toolResults) {
              const resultStr = JSON.stringify(res.result);
              const truncated =
                resultStr.length > 500
                  ? resultStr.slice(0, 500) + '...'
                  : resultStr;
              this.logger.log(`Tool result [${res.toolName}]: ${truncated}`);
            }
          }
        },
      }),
    );

    return result.text || '';
  }

  /**
   * Stream a response. Used for web chat.
   */
  async stream(context: AgentContext, messages: CoreMessage[]) {
    const tools = this.createTools(context);

    // Load current preferences for context (same as generate)
    const prefs = await this.screeningPreferences.getPreferences(
      context.organizationId,
    );
    const prefsContext = [
      prefs.dealCriteria
        ? `Current deal criteria: ${prefs.dealCriteria}`
        : null,
      prefs.skipCriteria
        ? `Current skip criteria: ${prefs.skipCriteria}`
        : null,
      prefs.knownProperties
        ? `Current known properties: ${prefs.knownProperties}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
    const systemWithContext = prefsContext
      ? `${SYSTEM_PROMPT}\n\nCURRENT PREFERENCES:\n${prefsContext}`
      : SYSTEM_PROMPT;

    return trackLlmStream(
      'chat_agent',
      streamText({
        model: openai(dealGeneralModelName()),
        system: systemWithContext,
        messages,
        tools,
        maxSteps: 5,
      }),
    );
  }

  /**
   * Wrap a tool execute function with error handling.
   * Returns { error: '...' } on failure instead of throwing.
   */
  private safeTool<T>(
    toolName: string,
    fn: () => Promise<T>,
  ): Promise<T | { error: string }> {
    return fn().catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool ${toolName} failed: ${msg}`);
      return { error: `Failed to execute ${toolName}. Please try again.` };
    });
  }

  /**
   * Find a contact by email or name search within the organization's deals.
   */
  private findContact(
    search: { contactEmail?: string; contactSearch?: string },
    orgWhere: { organizationId: string },
  ) {
    if (search.contactEmail) {
      return this.prisma.contact.findFirst({
        where: {
          email: { equals: search.contactEmail, mode: 'insensitive' },
          deals: { some: orgWhere },
        },
      });
    }
    if (search.contactSearch) {
      return this.prisma.contact.findFirst({
        where: {
          OR: [
            { email: { contains: search.contactSearch, mode: 'insensitive' } },
            {
              firstName: {
                contains: search.contactSearch,
                mode: 'insensitive',
              },
            },
            {
              lastName: { contains: search.contactSearch, mode: 'insensitive' },
            },
          ],
          deals: { some: orgWhere },
        },
      });
    }
    return Promise.resolve(null);
  }

  private createTools(context: AgentContext) {
    const { organizationId } = context;
    if (!organizationId) {
      throw new Error('organizationId is required for agent tools');
    }

    const orgWhere = { organizationId };

    return {
      get_deal_stats: tool({
        description:
          'Get aggregated statistics about deals (total count, yes/no decisions, etc.).',
        parameters: z.object({}),
        execute: async () =>
          this.safeTool('get_deal_stats', async () => {
            const [total, yesCount, noCount] = await Promise.all([
              this.prisma.deal.count({ where: orgWhere }),
              this.prisma.deal.count({
                where: { ...orgWhere, initialScreening: { decision: 'YES' } },
              }),
              this.prisma.deal.count({
                where: { ...orgWhere, initialScreening: { decision: 'NO' } },
              }),
            ]);
            return { total, decisions: { yes: yesCount, no: noCount } };
          }),
      }),

      get_broker_leaderboard: tool({
        description:
          'Get brokers ranked by deal count with pass rates, geographic focus, and activity. Use for "who sent the most deals?", "top brokers", "broker leaderboard".',
        parameters: z.object({
          limit: z
            .number()
            .optional()
            .default(10)
            .describe('Number of top brokers'),
          sortBy: z
            .enum(['dealCount', 'passRate'])
            .optional()
            .default('dealCount'),
          sinceDays: z
            .number()
            .optional()
            .describe('Only include deals from last N days'),
        }),
        execute: async ({ limit = 10, sortBy = 'dealCount', sinceDays }) =>
          this.safeTool('get_broker_leaderboard', async () => {
            const since = sinceDays
              ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
              : undefined;
            const leaderboard = await this.brokerIntelligence.getLeaderboard(
              organizationId,
              {
                limit,
                since,
                sortBy,
              },
            );
            return {
              brokers: leaderboard.brokers.map((b) => ({
                name:
                  [b.firstName, b.lastName].filter(Boolean).join(' ') ||
                  b.email,
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
          }),
      }),

      get_broker_stats: tool({
        description:
          'Get detailed stats for a specific broker. Use for "tell me about broker X", "what does [name] send?".',
        parameters: z.object({
          contactEmail: z.string().optional(),
          contactSearch: z.string().optional(),
        }),
        execute: async ({ contactEmail, contactSearch }) =>
          this.safeTool('get_broker_stats', async () => {
            const contact = await this.findContact(
              { contactEmail, contactSearch },
              orgWhere,
            );
            if (!contact) return { error: 'Broker not found' };

            const stats = await this.brokerIntelligence.getBrokerStats(
              contact.id,
              organizationId,
            );
            if (!stats) return { error: 'No deals found for this broker' };

            return {
              name:
                [stats.firstName, stats.lastName].filter(Boolean).join(' ') ||
                stats.email,
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
          }),
      }),

      get_deals_by_contact: tool({
        description:
          'Get all deals from a specific contact. Use contact email or name to search.',
        parameters: z.object({
          contactEmail: z.string().optional(),
          contactSearch: z.string().optional(),
          limit: z.number().optional().default(50),
        }),
        execute: async ({ contactEmail, contactSearch, limit = 50 }) =>
          this.safeTool('get_deals_by_contact', async () => {
            const contact = await this.findContact(
              { contactEmail, contactSearch },
              orgWhere,
            );
            if (!contact) return { error: 'Contact not found', deals: [] };
            const deals = await this.prisma.deal.findMany({
              where: { ...orgWhere, contactId: contact.id },
              take: limit,
              orderBy: { createdAt: 'desc' },
              include: { contact: true, initialScreening: true },
            });
            return { deals, contactId: contact.id };
          }),
      }),

      get_deals_by_location: tool({
        description: 'Get deals in a location (city, state, or address).',
        parameters: z.object({
          locationSearch: z.string(),
          limit: z.number().optional().default(50),
        }),
        execute: async ({ locationSearch, limit = 50 }) =>
          this.safeTool('get_deals_by_location', async () => {
            const assets = await this.prisma.asset.findMany({
              where: {
                OR: [
                  {
                    address: { contains: locationSearch, mode: 'insensitive' },
                  },
                  { city: { contains: locationSearch, mode: 'insensitive' } },
                  { state: { contains: locationSearch, mode: 'insensitive' } },
                  {
                    normalizedAddress: {
                      contains: locationSearch,
                      mode: 'insensitive',
                    },
                  },
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
          }),
      }),

      get_deals: tool({
        description:
          'Search and list deals. Prefer more specific tools when possible.',
        parameters: z.object({
          search: z.string().optional(),
          decision: z.enum(['YES', 'NO']).optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, decision, page = 1, limit = 20 }) =>
          this.safeTool('get_deals', async () => {
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
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            };
          }),
      }),

      get_contacts: tool({
        description: 'Search and list contacts (brokers).',
        parameters: z.object({
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, page = 1, limit = 20 }) =>
          this.safeTool('get_contacts', async () => {
            const where: Record<string, unknown> = {
              deals: { some: orgWhere },
            };
            if (search) {
              (where as any).OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ];
            }
            const skip = (page - 1) * limit;
            const [contacts, total] = await Promise.all([
              this.prisma.contact.findMany({
                where: where as any,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
              }),
              this.prisma.contact.count({ where: where as any }),
            ]);
            return {
              contacts,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            };
          }),
      }),

      get_assets: tool({
        description: 'Search and list properties/assets.',
        parameters: z.object({
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ search, page = 1, limit = 20 }) =>
          this.safeTool('get_assets', async () => {
            const where: Record<string, unknown> = {
              deals: { some: orgWhere },
            };
            if (search) {
              (where as any).OR = [
                { address: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { state: { contains: search, mode: 'insensitive' } },
                {
                  normalizedAddress: { contains: search, mode: 'insensitive' },
                },
              ];
            }
            const skip = (page - 1) * limit;
            const [assets, total] = await Promise.all([
              this.prisma.asset.findMany({
                where: where as any,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
              }),
              this.prisma.asset.count({ where: where as any }),
            ]);
            return {
              assets,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            };
          }),
      }),

      get_deal_details: tool({
        description: 'Get details for a specific deal by ID.',
        parameters: z.object({ dealId: z.string() }),
        execute: async ({ dealId }) =>
          this.safeTool('get_deal_details', async () => {
            const deal = await this.prisma.deal.findFirst({
              where: { id: dealId, ...orgWhere },
              include: {
                contact: true,
                asset: true,
                initialScreening: true,
                documents: true,
              },
            });
            if (!deal) return { error: 'Deal not found' };
            return deal;
          }),
      }),

      update_skip_criteria: tool({
        description:
          'Update free-text criteria for emails to always skip (not consider as deals). No analysis, no reply. Use when user says "skip X" or "ignore Y" for deal TYPES or categories.',
        parameters: z.object({
          criteria: z
            .string()
            .describe(
              'The criteria to always skip (e.g. "retail deals", "deals under 40 units", "emails from @broker.com")',
            ),
        }),
        execute: async ({ criteria }) =>
          this.safeTool('update_skip_criteria', async () => {
            const current =
              await this.screeningPreferences.getPreferences(organizationId);
            this.logger.log(
              `[update_skip_criteria] before="${current.skipCriteria ?? ''}" appending="${criteria}"`,
            );
            const merged = current.skipCriteria
              ? `${current.skipCriteria}, ${criteria}`
              : criteria;
            const updated = await this.screeningPreferences.updatePreferences(
              organizationId,
              { skipCriteria: merged },
            );
            this.logger.log(
              `[update_skip_criteria] after="${updated.skipCriteria}"`,
            );
            return { success: true, skipCriteria: updated.skipCriteria };
          }),
      }),

      update_known_properties: tool({
        description:
          'Add a property name/address to the known properties list. Emails about these properties are auto-skipped via regex. Use when user says "we own X", "that\'s our building", or "add X to known properties".',
        parameters: z.object({
          property: z
            .string()
            .describe(
              'The property name or address to add (e.g. "1006 S Michigan", "Bryant Plaza in Roslyn")',
            ),
        }),
        execute: async ({ property }) =>
          this.safeTool('update_known_properties', async () => {
            const current =
              await this.screeningPreferences.getPreferences(organizationId);
            this.logger.log(`[update_known_properties] adding="${property}"`);
            const merged = current.knownProperties
              ? `${current.knownProperties}\n${property}`
              : property;
            const updated = await this.screeningPreferences.updatePreferences(
              organizationId,
              { knownProperties: merged },
            );
            this.logger.log(
              `[update_known_properties] after="${updated.knownProperties}"`,
            );
            return { success: true, knownProperties: updated.knownProperties };
          }),
      }),

      update_deal_criteria: tool({
        description:
          'Update hard requirements for deal evaluation (YES/NO). Use when user specifies investment criteria like "New York only", "min 5% cap".',
        parameters: z.object({
          criteria: z.string().describe('The deal criteria for evaluation'),
        }),
        execute: async ({ criteria }) =>
          this.safeTool('update_deal_criteria', async () => {
            const current =
              await this.screeningPreferences.getPreferences(organizationId);
            this.logger.log(
              `[update_deal_criteria] before="${current.dealCriteria ?? ''}" appending="${criteria}"`,
            );
            const merged = current.dealCriteria
              ? `${current.dealCriteria}, ${criteria}`
              : criteria;
            const updated = await this.screeningPreferences.updatePreferences(
              organizationId,
              { dealCriteria: merged },
            );
            this.logger.log(
              `[update_deal_criteria] after="${updated.dealCriteria}"`,
            );
            return { success: true, dealCriteria: updated.dealCriteria };
          }),
      }),

      update_passed_folder: tool({
        description:
          'Update the folder name for passed/rejected deals (default "Passed Deals").',
        parameters: z.object({
          folderName: z.string().describe('Folder name for passed deals'),
        }),
        execute: async ({ folderName }) =>
          this.safeTool('update_passed_folder', async () => {
            const updated = await this.screeningPreferences.updatePreferences(
              organizationId,
              {
                passedFolderName: folderName,
              },
            );
            return {
              success: true,
              passedFolderName: updated.passedFolderName,
            };
          }),
      }),

      update_digest_schedule: tool({
        description:
          'Update when digest emails are sent. Provide cron expression and timezone.',
        parameters: z.object({
          schedule: z
            .string()
            .describe('CRON expression, e.g. "0 12 * * *" for daily noon'),
          timeZone: z
            .string()
            .optional()
            .default('America/New_York')
            .describe('Timezone for the schedule'),
        }),
        execute: async ({ schedule, timeZone }) =>
          this.safeTool('update_digest_schedule', async () => {
            const updated = await this.screeningPreferences.updatePreferences(
              organizationId,
              {
                digestSchedule: schedule,
                digestTimeZone: timeZone,
              },
            );
            return {
              success: true,
              digestSchedule: updated.digestSchedule,
              digestTimeZone: updated.digestTimeZone,
            };
          }),
      }),

      update_screening_bucket: tool({
        description:
          'Update criteria for a specific screening bucket (e.g. "Hot Deal", "Good Fit", "Pass"). Use when user wants to refine what goes into a specific classification tier.',
        parameters: z.object({
          bucketName: z
            .string()
            .describe('Name of the bucket to update (case-insensitive match)'),
          newDescription: z
            .string()
            .describe('Updated criteria description for the bucket'),
        }),
        execute: async ({ bucketName, newDescription }) =>
          this.safeTool('update_screening_bucket', async () => {
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
            return {
              success: true,
              bucket: updated.name,
              description: updated.description,
            };
          }),
      }),

      update_contact_notes: tool({
        description:
          'Add or update notes on a broker/contact. Use when user says "note: John Smith just had a baby" or "remember that broker X likes the Knicks". Appends to existing notes.',
        parameters: z.object({
          contactSearch: z
            .string()
            .describe('Name or email of the contact to update'),
          notes: z.string().describe('Notes to add about this contact'),
        }),
        execute: async ({ contactSearch, notes }) =>
          this.safeTool('update_contact_notes', async () => {
            const contact = await this.findContact({ contactSearch }, orgWhere);
            if (!contact)
              return { error: `Contact "${contactSearch}" not found` };

            const existingNotes = contact.notes || '';
            const updatedNotes = existingNotes
              ? `${existingNotes}\n${notes}`
              : notes;

            const updated = await this.prisma.contact.update({
              where: { id: contact.id },
              data: { notes: updatedNotes },
            });
            return {
              success: true,
              contact:
                [updated.firstName, updated.lastName]
                  .filter(Boolean)
                  .join(' ') || updated.email,
              notes: updated.notes,
            };
          }),
      }),

      update_contact_tags: tool({
        description:
          'Add or remove tags on a broker/contact. Use for categorizing brokers (e.g., "top broker", "responsive", "multifamily specialist").',
        parameters: z.object({
          contactSearch: z.string().describe('Name or email of the contact'),
          addTags: z.array(z.string()).optional().describe('Tags to add'),
          removeTags: z.array(z.string()).optional().describe('Tags to remove'),
        }),
        execute: async ({ contactSearch, addTags, removeTags }) =>
          this.safeTool('update_contact_tags', async () => {
            const contact = await this.findContact({ contactSearch }, orgWhere);
            if (!contact)
              return { error: `Contact "${contactSearch}" not found` };

            let tags = [...contact.tags];
            if (addTags) {
              for (const tag of addTags) {
                if (!tags.includes(tag)) tags.push(tag);
              }
            }
            if (removeTags) {
              tags = tags.filter((t) => !removeTags.includes(t));
            }

            const updated = await this.prisma.contact.update({
              where: { id: contact.id },
              data: { tags },
            });
            return {
              success: true,
              contact:
                [updated.firstName, updated.lastName]
                  .filter(Boolean)
                  .join(' ') || updated.email,
              tags: updated.tags,
            };
          }),
      }),

      get_contact_notes: tool({
        description: 'Get notes and tags for a specific broker/contact.',
        parameters: z.object({
          contactSearch: z.string().describe('Name or email of the contact'),
        }),
        execute: async ({ contactSearch }) =>
          this.safeTool('get_contact_notes', async () => {
            const contact = await this.findContact({ contactSearch }, orgWhere);
            if (!contact)
              return { error: `Contact "${contactSearch}" not found` };
            return {
              name:
                [contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(' ') || contact.email,
              email: contact.email,
              notes: contact.notes || 'No notes',
              tags: contact.tags,
            };
          }),
      }),

      get_current_preferences: tool({
        description:
          'Get the current screening preferences and bucket configuration. Use when user asks "what are my current criteria?" or before suggesting changes.',
        parameters: z.object({}),
        execute: async () =>
          this.safeTool('get_current_preferences', async () => {
            const prefs =
              await this.screeningPreferences.getPreferences(organizationId);
            const buckets = await this.prisma.screeningBucket.findMany({
              where: { organizationId },
              orderBy: { rank: 'asc' },
              select: {
                name: true,
                description: true,
                rank: true,
                isPass: true,
                action: true,
              },
            });
            return {
              dealCriteria: prefs.dealCriteria || 'Not set',
              skipCriteria: prefs.skipCriteria || 'Not set',
              knownProperties: prefs.knownProperties || 'Not set',
              passedFolderName: prefs.passedFolderName || 'Passed Deals',
              buckets: buckets.map((b) => ({
                name: b.name,
                criteria: b.description,
                decision: b.isPass ? 'YES' : 'NO',
                action: b.action,
              })),
            };
          }),
      }),

      mute_deal: tool({
        description:
          'Mute a specific deal so future emails about the same property from the same broker always auto-screen as NO. Use when user says "mute this deal", "I already passed on this", "suppress future follow-ups on this".',
        parameters: z.object({
          dealSearch: z
            .string()
            .describe(
              'Deal subject line or identifier to find the deal to mute',
            ),
          reason: z
            .string()
            .describe(
              'Why this deal is being muted (used as the auto-NO reason for future screenings)',
            ),
        }),
        execute: async ({ dealSearch, reason }) =>
          this.safeTool('mute_deal', async () => {
            const deal = await this.prisma.deal.findFirst({
              where: {
                organizationId,
                sourceSubject: { contains: dealSearch, mode: 'insensitive' },
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true, sourceSubject: true },
            });
            if (!deal)
              return { error: `No deal found matching "${dealSearch}"` };
            await this.prisma.deal.update({
              where: { id: deal.id },
              data: { isMuted: true, mutedAt: new Date(), mutedReason: reason },
            });
            return {
              success: true,
              dealId: deal.id,
              subject: deal.sourceSubject,
              mutedReason: reason,
            };
          }),
      }),

      // ==========================================
      // PUBLIC DATA — NYC Parcel Tools
      // ==========================================

      query_parcels: tool({
        description:
          'Search NYC parcels from public data. Filter by borough, distress score, lien status, tax bills, zip code, building class, list type, address. Use for "show me distressed parcels in Brooklyn", "top 10 parcels by score", "parcels with liens in Queens".',
        parameters: z.object({
          boroughs: z
            .array(z.string())
            .optional()
            .describe(
              'Borough codes: 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=SI',
            ),
          minDistressScore: z
            .number()
            .optional()
            .describe('Minimum distress score (0-100)'),
          maxDistressScore: z
            .number()
            .optional()
            .describe('Maximum distress score (0-100)'),
          hasActiveLien: z
            .boolean()
            .optional()
            .describe('Filter to parcels with active tax liens'),
          excludeCoops: z
            .boolean()
            .optional()
            .default(true)
            .describe('Exclude co-op buildings'),
          search: z
            .string()
            .optional()
            .describe('Address, BBL, or owner name search'),
          minUnits: z.number().optional(),
          maxUnits: z.number().optional(),
          minOutstandingTaxBill: z
            .number()
            .optional()
            .describe('Minimum outstanding property tax bill ($)'),
          maxOutstandingTaxBill: z
            .number()
            .optional()
            .describe('Maximum outstanding property tax bill ($)'),
          minLienSaleAmount: z
            .number()
            .optional()
            .describe('Minimum lien sale amount ($)'),
          maxLienSaleAmount: z
            .number()
            .optional()
            .describe('Maximum lien sale amount ($)'),
          zipCode: z.string().optional().describe('NYC zip code'),
          buildingClassGroups: z
            .array(z.enum(['residential', 'commercial', 'walkup']))
            .optional()
            .describe('Building class groups'),
          listType: z
            .enum(['IMMEDIATE', 'LONG_TERM', 'NOT_INTERESTED'])
            .optional()
            .describe('Filter by triage list assignment'),
          hasNoList: z
            .boolean()
            .optional()
            .describe('Only show parcels not on any list'),
          limit: z.number().optional().default(20),
          page: z.number().optional().default(1),
          sort: z.string().optional().default('distressScore'),
          order: z.enum(['asc', 'desc']).optional().default('desc'),
        }),
        execute: async (params) =>
          this.safeTool('query_parcels', async () => {
            const result = await this.parcelQuery.queryParcels({
              ...params,
              organizationId,
            });
            return {
              parcels: result.data.map((p) => ({
                bbl: p.bbl,
                address: p.address,
                borough: BOROUGH_NAMES[p.borough] || p.borough,
                distressScore: p.distressScore,
                buildingClass: p.buildingClass,
                unitsTotal: p.unitsTotal,
                buildingArea: p.buildingArea,
                estimatedMarketValue: p.estimatedMarketValue,
                yearBuilt: p.yearBuilt,
                ownerName: p.ownerName,
                hasActiveLien: p.hasActiveLien,
                lienCycle: p.lienCycle,
                violationsOpen: p.violationsOpen,
                violationsClassC: p.violationsClassC,
                violationsPerUnit: p.violationsPerUnit,
                outstandingTaxBill: p.outstandingTaxBill,
                totalOutstandingBalance: p.totalOutstandingBalance,
                lienSaleAmount: p.lienSaleAmount,
                lienRedemptiveValue: p.lienRedemptiveValue,
                lienServicer: p.lienServicer,
                lienMatchConfidence: p.lienMatchConfidence,
                listType:
                  (p as unknown as { _listType?: string })._listType || null,
              })),
              pagination: result.pagination,
            };
          }),
      }),

      get_parcel_stats: tool({
        description:
          'Get aggregate statistics about NYC parcels. Use for "how many parcels have liens?", "average distress score in Brooklyn", "parcel counts by borough".',
        parameters: z.object({
          boroughs: z
            .array(z.string())
            .optional()
            .describe('Borough codes to filter'),
          excludeCoops: z.boolean().optional().default(true),
          hasActiveLien: z.boolean().optional(),
          minDistressScore: z.number().optional(),
          maxDistressScore: z.number().optional(),
          minUnits: z.number().optional(),
          maxUnits: z.number().optional(),
          minOutstandingTaxBill: z.number().optional(),
          maxOutstandingTaxBill: z.number().optional(),
          minLienSaleAmount: z.number().optional(),
          maxLienSaleAmount: z.number().optional(),
          zipCode: z.string().optional(),
          buildingClassGroups: z
            .array(z.enum(['residential', 'commercial', 'walkup']))
            .optional(),
        }),
        execute: async (params) =>
          this.safeTool('get_parcel_stats', async () => {
            const stats = await this.parcelQuery.getStats(params);
            return {
              ...stats,
              byBorough: stats.byBorough.map((b) => ({
                ...b,
                boroughName: BOROUGH_NAMES[b.borough] || b.borough,
              })),
            };
          }),
      }),

      get_parcel_details: tool({
        description:
          'Get full details for a specific NYC parcel by BBL (Borough-Block-Lot). Use when user asks about a specific property, e.g. "tell me about 3012340001" or after seeing a parcel in query results.',
        parameters: z.object({
          bbl: z
            .string()
            .describe('10-digit BBL identifier (e.g. "3012340001")'),
        }),
        execute: async ({ bbl }) =>
          this.safeTool('get_parcel_details', async () => {
            const parcel = await this.parcelQuery.getParcelByBbl(
              bbl,
              organizationId,
            );
            if (!parcel) return { error: `Parcel not found: ${bbl}` };
            return {
              ...parcel,
              borough: BOROUGH_NAMES[parcel.borough] || parcel.borough,
            };
          }),
      }),

      get_parcels_by_list: tool({
        description:
          'Get parcels on a specific triage list (IMMEDIATE, LONG_TERM, NOT_INTERESTED). Use for "show my immediate list", "what parcels am I tracking?", "show not-interested parcels".',
        parameters: z.object({
          listType: z.enum(['IMMEDIATE', 'LONG_TERM', 'NOT_INTERESTED']),
          limit: z.number().optional().default(20),
          sort: z.string().optional().default('distressScore'),
          order: z.enum(['asc', 'desc']).optional().default('desc'),
        }),
        execute: async ({ listType, limit, sort, order }) =>
          this.safeTool('get_parcels_by_list', async () => {
            const result = await this.parcelQuery.queryParcels({
              listType,
              organizationId,
              limit,
              sort,
              order,
              page: 1,
            });
            return {
              listType,
              parcels: result.data.map((p) => ({
                bbl: p.bbl,
                address: p.address,
                borough: BOROUGH_NAMES[p.borough] || p.borough,
                distressScore: p.distressScore,
                unitsTotal: p.unitsTotal,
                buildingClass: p.buildingClass,
                hasActiveLien: p.hasActiveLien,
                outstandingTaxBill: p.outstandingTaxBill,
                lienSaleAmount: p.lienSaleAmount,
                ownerName: p.ownerName,
              })),
              total: result.pagination.total,
            };
          }),
      }),

      assign_parcel_list: tool({
        description:
          'Assign a parcel to a triage list (IMMEDIATE, LONG_TERM, NOT_INTERESTED) or remove from list. Use when user says "add this to my immediate list", "mark as not interested", "remove from list".',
        parameters: z.object({
          bbl: z.string().describe('10-digit BBL of the parcel'),
          listType: z
            .enum(['IMMEDIATE', 'LONG_TERM', 'NOT_INTERESTED'])
            .nullable()
            .describe('List to assign to, or null to remove from all lists'),
        }),
        execute: async ({ bbl, listType }) =>
          this.safeTool('assign_parcel_list', async () => {
            if (!context.userId)
              return { error: 'userId required for list assignment' };
            const result = await this.propertyList.assign({
              bbl,
              organizationId,
              userId: context.userId,
              listType: listType as ParcelListType | null,
            });
            return {
              success: true,
              bbl,
              listType: listType || 'removed',
              assignment: result,
            };
          }),
      }),

      get_parcel_phone_notes: tool({
        description:
          'Get phone notes/call log for a specific parcel. Use when user asks "what notes do we have on this parcel?", "have we called the owner of X?".',
        parameters: z.object({
          bbl: z.string().describe('10-digit BBL of the parcel'),
        }),
        execute: async ({ bbl }) =>
          this.safeTool('get_parcel_phone_notes', async () => {
            const parcel = await this.parcelQuery.getParcelByBbl(bbl);
            if (!parcel) return { error: `Parcel not found: ${bbl}` };
            const notes = await this.phoneNote.getNotesForParcel(
              parcel.id,
              organizationId,
            );
            return {
              bbl,
              address: parcel.address,
              notes: notes.length > 0 ? notes : 'No phone notes recorded',
            };
          }),
      }),

      update_parcel_phone_note: tool({
        description:
          'Add or update a phone note for a parcel owner contact. Use when user says "I called the owner of X, number was disconnected" or "spoke with owner at BBL Y, they are interested".',
        parameters: z.object({
          bbl: z.string().describe('10-digit BBL of the parcel'),
          phoneNumber: z.string().describe('Phone number the note is about'),
          status: z
            .enum(['GOOD', 'BAD', 'UNKNOWN'])
            .optional()
            .describe(
              'Phone status: GOOD (reached owner), BAD (disconnected/wrong), UNKNOWN',
            ),
          note: z.string().optional().describe('Free text note about the call'),
        }),
        execute: async ({ bbl, phoneNumber, status, note }) =>
          this.safeTool('update_parcel_phone_note', async () => {
            if (!context.userId)
              return { error: 'userId required for phone notes' };
            const result = await this.phoneNote.upsertNote({
              bbl,
              phoneNumber,
              organizationId,
              userId: context.userId,
              status: status as PhoneStatus | undefined,
              note,
            });
            return { success: true, bbl, ...result };
          }),
      }),
    };
  }
}
