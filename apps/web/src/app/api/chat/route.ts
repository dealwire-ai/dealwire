import { auth } from '@clerk/nextjs/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { apiClient } from '@/lib/api';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const { userId } = await auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organizationId by calling the deals endpoint (which requires auth)
    // We'll extract it from the auth context in the functions themselves
    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      system: `You are a helpful assistant for a real estate investment platform. You help users query their deals, contacts (brokers), and properties/assets.

Available data:
- Deals: Real estate acquisition opportunities with screening decisions (YES/NO), summaries, and metadata
- Contacts: Brokers and contacts who have sent deals, with email and name information
- Assets/Properties: Real estate properties with addresses, cities, states, and countries

IMPORTANT: Use the most specific tool for each question:
- For "who sent the most deals?" or ranking questions → use get_top_contacts_by_deal_count
- For overall statistics → use get_deal_stats
- For deals from a specific contact → use get_deals_by_contact
- For deals in a location → use get_deals_by_location
- Only use get_deals/get_contacts/get_assets for specific searches or when other tools don't fit

Never fetch all data by paginating through everything. Use targeted queries instead.

Respond very briefly and directly - do not restate the question or use markdown formatting. Just provide the answer in plain text.`,
      messages,
      tools: {
        get_deal_stats: {
          description: 'Get aggregated statistics about deals (total count, yes/no decisions, etc.). Use this for questions about overall deal counts or decision breakdowns.',
          parameters: z.object({}),
          execute: async () => {
            try {
              const response = await apiClient('/deals/stats');
              return response;
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch deal stats',
              };
            }
          },
        },
        get_top_contacts_by_deal_count: {
          description: 'Get contacts ranked by number of deals they have sent. Use this for questions like "who sent me the most deals?" or "top brokers".',
          parameters: z.object({
            limit: z.number().optional().default(10).describe('Number of top contacts to return'),
          }),
          execute: async ({ limit = 10 }) => {
            try {
              // Fetch deals with contact info, limit to reasonable amount for aggregation
              const response = await apiClient(`/deals?page=1&limit=500`);
              const deals = response.data || [];
              
              // Count deals per contact
              const contactCounts: Record<string, { contact: any; count: number }> = {};
              
              for (const deal of deals) {
                if (deal.contactId && deal.contact) {
                  const contactId = deal.contactId;
                  if (!contactCounts[contactId]) {
                    contactCounts[contactId] = {
                      contact: deal.contact,
                      count: 0,
                    };
                  }
                  contactCounts[contactId].count++;
                }
              }
              
              // Sort by count and return top N
              const topContacts = Object.values(contactCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, limit)
                .map(({ contact, count }) => ({
                  contact,
                  dealCount: count,
                }));
              
              return { topContacts, totalAnalyzed: deals.length };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch top contacts',
              };
            }
          },
        },
        get_deals_by_contact: {
          description: 'Get all deals sent by a specific contact. Use contact email or name to search.',
          parameters: z.object({
            contactEmail: z.string().optional().describe('Email address of the contact'),
            contactSearch: z.string().optional().describe('Search term to find contact (searches email, first name, last name)'),
            limit: z.number().optional().default(50).describe('Maximum number of deals to return'),
          }),
          execute: async ({ contactEmail, contactSearch, limit = 50 }) => {
            try {
              // First find the contact
              let contactId: string | null = null;
              if (contactEmail) {
                const contactsResponse = await apiClient(`/contacts?search=${encodeURIComponent(contactEmail)}&limit=10`);
                const contacts = contactsResponse.data || [];
                const found = contacts.find((c: any) => c.email.toLowerCase() === contactEmail.toLowerCase());
                if (found) contactId = found.id;
              } else if (contactSearch) {
                const contactsResponse = await apiClient(`/contacts?search=${encodeURIComponent(contactSearch)}&limit=10`);
                const contacts = contactsResponse.data || [];
                if (contacts.length > 0) contactId = contacts[0].id;
              }
              
              if (!contactId) {
                return { error: 'Contact not found', deals: [] };
              }
              
              // Fetch deals and filter by contactId
              const dealsResponse = await apiClient(`/deals?page=1&limit=${limit}`);
              const allDeals = dealsResponse.data || [];
              const deals = allDeals.filter((d: any) => d.contactId === contactId).slice(0, limit);
              
              return { deals, contactId };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch deals by contact',
              };
            }
          },
        },
        get_deals_by_location: {
          description: 'Get deals filtered by location (city, state, or address search). Use this for questions about deals in specific areas.',
          parameters: z.object({
            locationSearch: z.string().describe('Search term for location (city, state, or address)'),
            limit: z.number().optional().default(50).describe('Maximum number of deals to return'),
          }),
          execute: async ({ locationSearch, limit = 50 }) => {
            try {
              // Search assets first, then get deals for those assets
              const assetsResponse = await apiClient(`/assets?search=${encodeURIComponent(locationSearch)}&limit=50`);
              const assets = assetsResponse.data || [];
              const assetIds = assets.map((a: any) => a.id);
              
              // Fetch deals and filter by asset
              const dealsResponse = await apiClient(`/deals?page=1&limit=${limit}`);
              const allDeals = dealsResponse.data || [];
              const deals = allDeals.filter((d: any) => assetIds.includes(d.assetId)).slice(0, limit);
              
              return { deals, matchingAssets: assets.length };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch deals by location',
              };
            }
          },
        },
        get_deals: {
          description: 'Search and list deals. Use sparingly - prefer more specific tools. Can filter by search term, decision (YES/NO), and pagination.',
          parameters: z.object({
            search: z.string().optional().describe('Search term to filter deals (searches subject, sender, etc.)'),
            decision: z.enum(['YES', 'NO']).optional().describe('Filter by screening decision'),
            page: z.number().optional().default(1).describe('Page number for pagination'),
            limit: z.number().optional().default(20).describe('Number of results per page (max 100)'),
          }),
          execute: async ({ search, decision, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: Math.min(limit, 100).toString(),
              });
              if (search) params.append('search', search);
              if (decision) params.append('decision', decision);

              const response = await apiClient(`/deals?${params.toString()}`);
              return {
                deals: response.data || [],
                pagination: response.pagination || {},
              };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch deals',
              };
            }
          },
        },
        get_contacts: {
          description: 'Search and list contacts (brokers). Use sparingly - prefer get_top_contacts_by_deal_count for ranking questions.',
          parameters: z.object({
            search: z.string().optional().describe('Search term to filter contacts (searches email, first name, last name)'),
            page: z.number().optional().default(1).describe('Page number for pagination'),
            limit: z.number().optional().default(20).describe('Number of results per page (max 50)'),
          }),
          execute: async ({ search, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: Math.min(limit, 50).toString(),
              });
              if (search) params.append('search', search);

              const response = await apiClient(`/contacts?${params.toString()}`);
              return {
                contacts: response.data || [],
                pagination: response.pagination || {},
              };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch contacts',
              };
            }
          },
        },
        get_assets: {
          description: 'Search and list properties/assets. Can filter by search term and pagination.',
          parameters: z.object({
            search: z.string().optional().describe('Search term to filter assets (searches address, city, state)'),
            page: z.number().optional().default(1).describe('Page number for pagination'),
            limit: z.number().optional().default(20).describe('Number of results per page (max 50)'),
          }),
          execute: async ({ search, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: Math.min(limit, 50).toString(),
              });
              if (search) params.append('search', search);

              const response = await apiClient(`/assets?${params.toString()}`);
              return {
                assets: response.data || [],
                pagination: response.pagination || {},
              };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch assets',
              };
            }
          },
        },
        get_deal_details: {
          description: 'Get detailed information about a specific deal by ID.',
          parameters: z.object({
            dealId: z.string().describe('The ID of the deal to retrieve'),
          }),
          execute: async ({ dealId }) => {
            try {
              const response = await apiClient(`/deals/${dealId}`);
              return response;
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : 'Failed to fetch deal details',
              };
            }
          },
        },
      },
      maxSteps: 5,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
