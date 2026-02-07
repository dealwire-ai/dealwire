"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactsTableProps {
  contacts: Contact[];
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
}

export function ContactsTable({
  contacts,
  expandedRows,
  onToggleRow,
}: ContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        No contacts found.
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
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => {
          const isExpanded = expandedRows.has(contact.id);
          return (
            <>
              <TableRow
                key={contact.id}
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
                <TableCell>
                  {new Date(contact.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-zinc-950/50 p-4 transition-all duration-200">
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
                              <span className="text-zinc-500">Last Name: </span>
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
                              {new Date(contact.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
