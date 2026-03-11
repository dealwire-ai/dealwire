"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DebugPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Info</h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Clerk User Info</h2>
            <div className="bg-zinc-800 p-4 rounded font-mono text-sm overflow-auto">
              <pre>
                {JSON.stringify(
                  {
                    id: user.id,
                    email: user.emailAddresses?.[0]?.emailAddress,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    organizationId:
                      user.organizationMemberships?.[0]?.organization?.id ||
                      null,
                    organizationName:
                      user.organizationMemberships?.[0]?.organization?.name ||
                      null,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2 text-yellow-400">
              🔧 Database Sync Required:
            </h2>
            {user.organizationMemberships?.[0] ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-300">
                  ✅ You&apos;re in Clerk organization:{" "}
                  <strong>
                    {user.organizationMemberships[0].organization.name}
                  </strong>
                </p>
                <p className="text-sm text-zinc-300">
                  Now we need to sync this to your local database.
                </p>
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Copy and run this EXACT command:
                  </p>
                  <div className="relative">
                    <pre className="bg-zinc-800 p-3 rounded font-mono text-xs overflow-auto border border-zinc-700">
                      {`psql "postgresql://isaac@localhost:5432/dealwire" -c "INSERT INTO \\"User\\" (id, email, \\"organizationId\\", \\"createdAt\\", \\"updatedAt\\") VALUES ('${user.id}', '${user.emailAddresses?.[0]?.emailAddress}', '${user.organizationMemberships[0].organization.id}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET \\"organizationId\\" = '${user.organizationMemberships[0].organization.id}', \\"updatedAt\\" = NOW();"`}
                    </pre>
                    <button
                      onClick={() => {
                        const cmd = `psql "postgresql://isaac@localhost:5432/dealwire" -c "INSERT INTO \\"User\\" (id, email, \\"organizationId\\", \\"createdAt\\", \\"updatedAt\\") VALUES ('${user.id}', '${user.emailAddresses?.[0]?.emailAddress}', '${user.organizationMemberships[0].organization.id}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET \\"organizationId\\" = '${user.organizationMemberships[0].organization.id}', \\"updatedAt\\" = NOW();"`;
                        navigator.clipboard.writeText(cmd);
                        alert("Command copied to clipboard!");
                      }}
                      className="absolute top-2 right-2 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  This will sync your user ({user.id}) with organization{" "}
                  {user.organizationMemberships[0].organization.id} in the
                  database.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-300">
                  ⚠️ You&apos;re not in a Clerk organization. Please create or
                  join an organization in your Clerk dashboard first.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
