"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealsTable } from "@/components/deals-table";
import { ContactsTable } from "@/components/contacts-table";
import { AssetsTable } from "@/components/assets-table";
import { useApi } from "@/hooks/use-api";

interface Deal {
  id: string;
  sourceSubject: string | null;
  sourceFrom: string | null;
  sourceReceivedAt: string | null;
  initialScreeningDecision: "YES" | "NO" | null;
  initialScreeningSummary: string | null;
  detectionConfidence: string | null;
  detectionReason: string | null;
  folderMovedTo: string | null;
  sourceMessageId?: string | null;
  assetId?: string | null;
  contactId?: string | null;
  createdAt: string;
  updatedAt: string;
  receivedByUser?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  documents?: Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
}

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Asset {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  normalizedAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const { apiCall } = useApi();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState({
    deals: true,
    contacts: true,
    assets: true,
  });
  const [errors, setErrors] = useState({
    deals: null as string | null,
    contacts: null as string | null,
    assets: null as string | null,
  });

  // Tab and expansion state management
  const [activeTab, setActiveTab] = useState("deals");
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(
    new Set()
  );
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  // Function to navigate to a tab and expand a specific row
  const navigateToTabAndExpand = (
    tab: "deals" | "contacts" | "properties",
    id: string
  ) => {
    setActiveTab(tab);
    if (tab === "deals") {
      setExpandedDeals(new Set([id]));
    } else if (tab === "contacts") {
      setExpandedContacts(new Set([id]));
    } else if (tab === "properties") {
      setExpandedAssets(new Set([id]));
    }
  };

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/sign-in");
      return;
    }

    if (!isLoaded || !userId) {
      return;
    }

    // Fetch all data on mount
    const fetchDeals = async () => {
      try {
        setLoading((prev) => ({ ...prev, deals: true }));
        setErrors((prev) => ({ ...prev, deals: null }));
        const response = await apiCall("/deals?page=1&limit=100");
        setDeals(response.data || []);
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          deals: e instanceof Error ? e.message : "Failed to load deals",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, deals: false }));
      }
    };

    const fetchContacts = async () => {
      try {
        setLoading((prev) => ({ ...prev, contacts: true }));
        setErrors((prev) => ({ ...prev, contacts: null }));
        const response = await apiCall("/contacts?page=1&limit=100");
        setContacts(response.data || []);
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          contacts: e instanceof Error ? e.message : "Failed to load contacts",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, contacts: false }));
      }
    };

    const fetchAssets = async () => {
      try {
        setLoading((prev) => ({ ...prev, assets: true }));
        setErrors((prev) => ({ ...prev, assets: null }));
        const response = await apiCall("/assets?page=1&limit=100");
        setAssets(response.data || []);
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          assets: e instanceof Error ? e.message : "Failed to load properties",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, assets: false }));
      }
    };

    fetchDeals();
    fetchContacts();
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12 text-zinc-400">Loading...</div>
        </div>
      </div>
    );
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>

            <TabsContent value="deals" className="mt-6">
              {errors.deals && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.deals}
                </div>
              )}
              {loading.deals ? (
                <div className="text-center py-8 text-zinc-400">
                  Loading deals...
                </div>
              ) : (
                <DealsTable
                  deals={deals}
                  assets={assets}
                  contacts={contacts}
                  expandedRows={expandedDeals}
                  onToggleRow={(id) => {
                    const newExpanded = new Set(expandedDeals);
                    if (newExpanded.has(id)) {
                      newExpanded.delete(id);
                    } else {
                      newExpanded.add(id);
                    }
                    setExpandedDeals(newExpanded);
                  }}
                  onNavigateToAsset={(assetId) =>
                    navigateToTabAndExpand("properties", assetId)
                  }
                  onNavigateToContact={(contactId) =>
                    navigateToTabAndExpand("contacts", contactId)
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              {errors.contacts && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.contacts}
                </div>
              )}
              {loading.contacts ? (
                <div className="text-center py-8 text-zinc-400">
                  Loading contacts...
                </div>
              ) : (
                <ContactsTable
                  contacts={contacts}
                  expandedRows={expandedContacts}
                  onToggleRow={(id) => {
                    const newExpanded = new Set(expandedContacts);
                    if (newExpanded.has(id)) {
                      newExpanded.delete(id);
                    } else {
                      newExpanded.add(id);
                    }
                    setExpandedContacts(newExpanded);
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="properties" className="mt-6">
              {errors.assets && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.assets}
                </div>
              )}
              {loading.assets ? (
                <div className="text-center py-8 text-zinc-400">
                  Loading properties...
                </div>
              ) : (
                <AssetsTable
                  assets={assets}
                  expandedRows={expandedAssets}
                  onToggleRow={(id) => {
                    const newExpanded = new Set(expandedAssets);
                    if (newExpanded.has(id)) {
                      newExpanded.delete(id);
                    } else {
                      newExpanded.add(id);
                    }
                    setExpandedAssets(newExpanded);
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
