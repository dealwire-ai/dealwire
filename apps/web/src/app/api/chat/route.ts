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

When users ask questions, use the available functions to query the data. Respond very briefly and directly - do not restate the question or use markdown formatting. Just provide the answer in plain text.`,
      messages,
      tools: {
        get_deals: {
          description: 'Search and list deals. Can filter by search term, decision (YES/NO), and pagination.',
          parameters: z.object({
            search: z.string().optional().describe('Search term to filter deals (searches subject, sender, etc.)'),
            decision: z.enum(['YES', 'NO']).optional().describe('Filter by screening decision'),
            page: z.number().optional().default(1).describe('Page number for pagination'),
            limit: z.number().optional().default(20).describe('Number of results per page'),
          }),
          execute: async ({ search, decision, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
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
          description: 'Search and list contacts (brokers). Can filter by search term and pagination.',
          parameters: z.object({
            search: z.string().optional().describe('Search term to filter contacts (searches email, first name, last name)'),
            page: z.number().optional().default(1).describe('Page number for pagination'),
            limit: z.number().optional().default(20).describe('Number of results per page'),
          }),
          execute: async ({ search, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
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
            limit: z.number().optional().default(20).describe('Number of results per page'),
          }),
          execute: async ({ search, page = 1, limit = 20 }) => {
            try {
              const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
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
