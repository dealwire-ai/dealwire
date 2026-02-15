"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DealsTable } from "@/components/deals-table";
import { ContactsTable } from "@/components/contacts-table";
import { AssetsTable } from "@/components/assets-table";
import { TableToolbar } from "@/components/table-toolbar";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useApi } from "@/hooks/use-api";
import { useTableState } from "@/hooks/use-table-state";
import { Chatbot } from "@/components/chat/chatbot";
import posthog from "posthog-js";

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
  initialScreening?: {
    decision: "YES" | "NO";
    reason: string;
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
  const { user } = useUser();
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

  // Table state per tab
  const dealsTable = useTableState();
  const contactsTable = useTableState();
  const assetsTable = useTableState();

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
      posthog.capture("deal_navigate_to_contact", { deal_id: id });
      setExpandedDeals(new Set([id]));
    } else if (tab === "contacts") {
      posthog.capture("deal_navigate_to_contact", { contact_id: id });
      setExpandedContacts(new Set([id]));
    } else if (tab === "properties") {
      posthog.capture("deal_navigate_to_property", { property_id: id });
      setExpandedAssets(new Set([id]));
    }
  };

  // Handle tab change with tracking
  const handleTabChange = (tab: string) => {
    posthog.capture("dashboard_tab_changed", {
      from_tab: activeTab,
      to_tab: tab,
    });
    setActiveTab(tab);
  };

  // Identify user in PostHog when they access the dashboard
  useEffect(() => {
    if (isLoaded && user) {
      const email = user.emailAddresses?.[0]?.emailAddress;
      posthog.identify(userId!, {
        email: email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    }
  }, [isLoaded, user, userId]);

  // Fetch deals when table state changes
  const fetchDeals = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      setLoading((prev) => ({ ...prev, deals: true }));
      setErrors((prev) => ({ ...prev, deals: null }));
      const response = await apiCall(`/deals?${dealsTable.queryString}`);
      setDeals(response.data || []);
      if (response.pagination) dealsTable.setMeta(response.pagination);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        deals: e instanceof Error ? e.message : "Failed to load deals",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, deals: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, dealsTable.queryString]);

  // Fetch contacts when table state changes
  const fetchContacts = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      setLoading((prev) => ({ ...prev, contacts: true }));
      setErrors((prev) => ({ ...prev, contacts: null }));
      const response = await apiCall(`/contacts?${contactsTable.queryString}`);
      setContacts(response.data || []);
      if (response.pagination) contactsTable.setMeta(response.pagination);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        contacts: e instanceof Error ? e.message : "Failed to load contacts",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, contacts: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, contactsTable.queryString]);

  // Fetch assets when table state changes
  const fetchAssets = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      setLoading((prev) => ({ ...prev, assets: true }));
      setErrors((prev) => ({ ...prev, assets: null }));
      const response = await apiCall(`/assets?${assetsTable.queryString}`);
      setAssets(response.data || []);
      if (response.pagination) assetsTable.setMeta(response.pagination);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        assets: e instanceof Error ? e.message : "Failed to load properties",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, assets: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, assetsTable.queryString]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/sign-in");
    }
  }, [isLoaded, userId, router]);

  // Fetch data when query strings change
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Clear expanded rows on page change
  useEffect(() => {
    setExpandedDeals(new Set());
  }, [dealsTable.page]);

  useEffect(() => {
    setExpandedContacts(new Set());
  }, [contactsTable.page]);

  useEffect(() => {
    setExpandedAssets(new Set());
  }, [assetsTable.page]);

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
            onClick={() => {
              posthog.capture("sign_out_clicked");
              posthog.reset();
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            Sign Out
          </a>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>

            <TabsContent value="deals" className="mt-6">
              <TableToolbar
                search={dealsTable.search}
                onSearchChange={dealsTable.setSearch}
                totalLabel="deals"
                total={dealsTable.meta.total}
                hasActiveFilters={dealsTable.hasActiveFilters}
                onClearFilters={dealsTable.clearFilters}
                filterSlot={
                  <Select
                    value={dealsTable.filters.decision || "all"}
                    onValueChange={(value) =>
                      dealsTable.setFilter("decision", value === "all" ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-[130px] bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="YES">Yes</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              {errors.deals && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.deals}
                </div>
              )}
              {loading.deals ? (
                <TableSkeleton columns={6} />
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
                      posthog.capture("deal_row_expanded", { deal_id: id });
                    }
                    setExpandedDeals(newExpanded);
                  }}
                  onNavigateToAsset={(assetId) =>
                    navigateToTabAndExpand("properties", assetId)
                  }
                  onNavigateToContact={(contactId) =>
                    navigateToTabAndExpand("contacts", contactId)
                  }
                  hasActiveFilters={dealsTable.hasActiveFilters}
                  onClearFilters={dealsTable.clearFilters}
                />
              )}
              <TablePagination
                page={dealsTable.page}
                totalPages={dealsTable.meta.totalPages}
                total={dealsTable.meta.total}
                limit={dealsTable.limit}
                onPageChange={dealsTable.setPage}
              />
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <TableToolbar
                search={contactsTable.search}
                onSearchChange={contactsTable.setSearch}
                totalLabel="contacts"
                total={contactsTable.meta.total}
                hasActiveFilters={contactsTable.hasActiveFilters}
                onClearFilters={contactsTable.clearFilters}
              />
              {errors.contacts && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.contacts}
                </div>
              )}
              {loading.contacts ? (
                <TableSkeleton columns={5} />
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
                  hasActiveFilters={contactsTable.hasActiveFilters}
                  onClearFilters={contactsTable.clearFilters}
                />
              )}
              <TablePagination
                page={contactsTable.page}
                totalPages={contactsTable.meta.totalPages}
                total={contactsTable.meta.total}
                limit={contactsTable.limit}
                onPageChange={contactsTable.setPage}
              />
            </TabsContent>

            <TabsContent value="properties" className="mt-6">
              <TableToolbar
                search={assetsTable.search}
                onSearchChange={assetsTable.setSearch}
                totalLabel="properties"
                total={assetsTable.meta.total}
                hasActiveFilters={assetsTable.hasActiveFilters}
                onClearFilters={assetsTable.clearFilters}
              />
              {errors.assets && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
                  {errors.assets}
                </div>
              )}
              {loading.assets ? (
                <TableSkeleton columns={6} />
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
                  hasActiveFilters={assetsTable.hasActiveFilters}
                  onClearFilters={assetsTable.clearFilters}
                />
              )}
              <TablePagination
                page={assetsTable.page}
                totalPages={assetsTable.meta.totalPages}
                total={assetsTable.meta.total}
                limit={assetsTable.limit}
                onPageChange={assetsTable.setPage}
              />
            </TabsContent>
          </Tabs>
        </div>

        <Chatbot />
      </div>
    </div>
  );
}
