import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default async function DashboardPage() {
  const { userId } = await auth();
  
  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch deals from API
  let deals = [];
  let error = null;
  
  try {
    const response = await apiClient('/deals');
    deals = response.data || [];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load deals';
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <a
            href="/api/auth/signout"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            Sign Out
          </a>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Deals</h2>
          
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
              {error}
            </div>
          )}

          {!error && deals.length === 0 && (
            <p className="text-zinc-400">No deals found yet.</p>
          )}

          {!error && deals.length > 0 && (
            <div className="space-y-4">
              {deals.map((deal: any) => (
                <div
                  key={deal.id}
                  className="p-4 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{deal.sourceSubject || 'No Subject'}</h3>
                    {deal.initialScreeningDecision && (
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          deal.initialScreeningDecision === 'YES'
                            ? 'bg-green-900/30 text-green-400 border border-green-900/50'
                            : 'bg-red-900/30 text-red-400 border border-red-900/50'
                        }`}
                      >
                        {deal.initialScreeningDecision}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">From: {deal.sourceFrom || 'Unknown'}</p>
                  {deal.sourceReceivedAt && (
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(deal.sourceReceivedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400">
            <strong>API Response:</strong> Successfully connected to{' '}
            <code className="px-2 py-1 bg-zinc-800 rounded text-xs">
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/deals
            </code>
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            Total deals: {deals.length}
          </p>
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg">
          <p className="text-sm text-blue-400">
            💡 Getting a 403 error? Visit{' '}
            <a href="/debug" className="underline hover:text-blue-300">
              /debug
            </a>{' '}
            to see your user info and sync instructions.
          </p>
        </div>
      </div>
    </div>
  );
}
