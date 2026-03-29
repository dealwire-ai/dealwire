"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeDate } from "@/lib/date-utils";
import type { Contact } from "@/types/api";

interface ContactsTableProps {
  contacts: Contact[];
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function ContactsTable({
  contacts,
  expandedRows,
  onToggleRow,
  hasActiveFilters,
  onClearFilters,
}: ContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>
          {hasActiveFilters
            ? "No contacts match your search."
            : "No contacts found."}
        </p>
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-2 text-sm text-[#C8A96E] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Email</TableHead>
          <TableHead>First Name</TableHead>
          <TableHead>Last Name</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => {
          const isExpanded = expandedRows.has(contact.id);
          return (
            <Fragment key={contact.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => onToggleRow(contact.id)}
              >
                <TableCell>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{contact.email}</TableCell>
                <TableCell>{contact.firstName || "-"}</TableCell>
                <TableCell>{contact.lastName || "-"}</TableCell>
                <TableCell>{formatRelativeDate(contact.createdAt)}</TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="bg-zinc-950/50 p-0 transition-all duration-200"
                  >
                    <div className="border-l-2 border-[#C8A96E] pl-4 py-4 pr-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-zinc-400 mb-2 font-medium">
                            Contact Information
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-zinc-500">Email: </span>
                              <span className="text-zinc-300">
                                {contact.email}
                              </span>
                            </div>
                            {contact.firstName && (
                              <div>
                                <span className="text-zinc-500">
                                  First Name:{" "}
                                </span>
                                <span className="text-zinc-300">
                                  {contact.firstName}
                                </span>
                              </div>
                            )}
                            {contact.lastName && (
                              <div>
                                <span className="text-zinc-500">
                                  Last Name:{" "}
                                </span>
                                <span className="text-zinc-300">
                                  {contact.lastName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-400 mb-2 font-medium">
                            Metadata
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-zinc-500">Created: </span>
                              <span className="text-zinc-300">
                                {new Date(contact.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Updated: </span>
                              <span className="text-zinc-300">
                                {formatRelativeDate(contact.updatedAt)}
                              </span>
                            </div>
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
