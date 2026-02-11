import { auth } from '@clerk/nextjs/server';
import { getPostHogClient } from '@/lib/posthog-server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const { userId, getToken } = await auth();
    const token = await getToken();
    if (!userId || !token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const posthog = getPostHogClient();
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop();
    posthog.capture({
      distinctId: userId,
      event: 'chat_api_called',
      properties: {
        messages_count: messages.length,
        last_message_length: lastUserMessage?.content?.length || 0,
      },
    });

    const apiRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text().catch(() => apiRes.statusText);
      return new Response(err || String(apiRes.status), {
        status: apiRes.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response(apiRes.body, {
      status: apiRes.status,
      headers: Object.fromEntries(apiRes.headers.entries()),
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
