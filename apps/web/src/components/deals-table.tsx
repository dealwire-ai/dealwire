"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Deal {
  id: string;
  sourceSubject: string | null;
  sourceFrom: string | null;
  sourceReceivedAt: string | null;
  initialScreeningDecision: "YES" | "NO" | null;
  initialScreeningSummary: string | null;
  folderMovedTo: string | null;
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

interface Asset {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface DealsTableProps {
  deals: Deal[];
  assets: Asset[];
  contacts: Contact[];
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
  onNavigateToAsset: (assetId: string) => void;
  onNavigateToContact: (contactId: string) => void;
}

export function DealsTable({
  deals,
  assets,
  contacts,
  expandedRows,
  onToggleRow,
  onNavigateToAsset,
  onNavigateToContact,
}: DealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">No deals found.</div>
    );
  }

  const getAsset = (assetId: string | null | undefined) => {
    if (!assetId) return null;
    return assets.find((a) => a.id === assetId);
  };

  const getContact = (contactId: string | null | undefined) => {
    if (!contactId) return null;
    return contacts.find((c) => c.id === contactId);
  };

  const formatAddress = (asset: Asset | null) => {
    if (!asset) return "Unknown";
    const parts = [asset.address, asset.city, asset.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Unknown";
  };

  const formatContactName = (contact: Contact | null) => {
    if (!contact) return "Unknown";
    const nameParts = [contact.firstName, contact.lastName].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(" ") : contact.email;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Received Date</TableHead>
          <TableHead>Decision</TableHead>
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((deal) => {
          const isExpanded = expandedRows.has(deal.id);
          const asset = getAsset(deal.assetId);
          const contact = getContact(deal.contactId);

          return (
            <Fragment key={deal.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => onToggleRow(deal.id)}
              >
                <TableCell>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {deal.sourceSubject || "No Subject"}
                </TableCell>
                <TableCell>{deal.sourceFrom || "Unknown"}</TableCell>
                <TableCell>
                  {deal.sourceReceivedAt
                    ? new Date(deal.sourceReceivedAt).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>
                  {(deal.initialScreening?.decision || deal.initialScreeningDecision) ? (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        (deal.initialScreening?.decision || deal.initialScreeningDecision) === "YES"
                          ? "bg-green-900/30 text-green-400 border border-green-900/50"
                          : "bg-red-900/30 text-red-400 border border-red-900/50"
                      }`}
                    >
                      {deal.initialScreening?.decision || deal.initialScreeningDecision}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {new Date(deal.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-zinc-950/50 p-4 transition-all duration-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-400 mb-2 font-medium">
                          Details
                        </div>
                        <div className="space-y-2">
                          {deal.initialScreening?.reason && (
                            <div>
                              <span className="text-zinc-500">
                                Screening Reason:{" "}
                              </span>
                              <span className="text-zinc-300">
                                {deal.initialScreening.reason}
                              </span>
                            </div>
                          )}
                          {deal.initialScreeningSummary && (
                            <div>
                              <span className="text-zinc-500">
                                Screening Summary:{" "}
                              </span>
                              <span className="text-zinc-300">
                                {deal.initialScreeningSummary}
                              </span>
                            </div>
                          )}
                          {deal.folderMovedTo && (
                            <div>
                              <span className="text-zinc-500">Folder: </span>
                              <span className="text-zinc-300">
                                {deal.folderMovedTo}
                              </span>
                            </div>
                          )}
                          {deal.receivedByUser && (
                            <div>
                              <span className="text-zinc-500">
                                Received By:{" "}
                              </span>
                              <span className="text-zinc-300">
                                {deal.receivedByUser.firstName || ""}{" "}
                                {deal.receivedByUser.lastName || ""} (
                                {deal.receivedByUser.email})
                              </span>
                            </div>
                          )}
                          {deal.documents && deal.documents.length > 0 && (
                            <div>
                              <span className="text-zinc-500">
                                Documents ({deal.documents.length}):{" "}
                              </span>
                              <div className="mt-1 space-y-1">
                                {deal.documents.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="text-zinc-300 text-xs"
                                  >
                                    • {doc.filename} (
                                    {(doc.sizeBytes / 1024).toFixed(1)} KB)
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-400 mb-2 font-medium">
                          Related
                        </div>
                        <div className="space-y-3">
                          {deal.assetId && asset && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToAsset(deal.assetId!);
                              }}
                              className="group w-full text-left p-3 rounded-lg border border-zinc-800 hover:border-[#3ECFA0]/50 bg-zinc-900/50 hover:bg-zinc-900 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-zinc-400 text-xs mb-1">
                                    Property
                                  </div>
                                  <div className="text-white font-medium">
                                    {formatAddress(asset)}
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-[#3ECFA0] transition-colors" />
                              </div>
                            </button>
                          )}
                          {deal.contactId && contact && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToContact(deal.contactId!);
                              }}
                              className="group w-full text-left p-3 rounded-lg border border-zinc-800 hover:border-[#3ECFA0]/50 bg-zinc-900/50 hover:bg-zinc-900 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-zinc-400 text-xs mb-1">
                                    Contact
                                  </div>
                                  <div className="text-white font-medium">
                                    {formatContactName(contact)}
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-[#3ECFA0] transition-colors" />
                              </div>
                            </button>
                          )}
                          <div>
                            <span className="text-zinc-500">Updated: </span>
                            <span className="text-zinc-300">
                              {new Date(deal.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
