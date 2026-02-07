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

interface AssetsTableProps {
  assets: Asset[];
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
}

export function AssetsTable({
  assets,
  expandedRows,
  onToggleRow,
}: AssetsTableProps) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        No properties found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Address</TableHead>
          <TableHead>City</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const isExpanded = expandedRows.has(asset.id);
          return (
            <Fragment key={asset.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => onToggleRow(asset.id)}
              >
                <TableCell>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {asset.address || "-"}
                </TableCell>
                <TableCell>{asset.city || "-"}</TableCell>
                <TableCell>{asset.state || "-"}</TableCell>
                <TableCell>{asset.country || "-"}</TableCell>
                <TableCell>
                  {new Date(asset.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-zinc-950/50 p-4 transition-all duration-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-400 mb-2 font-medium">
                          Property Details
                        </div>
                        <div className="space-y-2">
                          {asset.address && (
                            <div>
                              <span className="text-zinc-500">Address: </span>
                              <span className="text-zinc-300">
                                {asset.address}
                              </span>
                            </div>
                          )}
                          {asset.city && (
                            <div>
                              <span className="text-zinc-500">City: </span>
                              <span className="text-zinc-300">
                                {asset.city}
                              </span>
                            </div>
                          )}
                          {asset.state && (
                            <div>
                              <span className="text-zinc-500">State: </span>
                              <span className="text-zinc-300">
                                {asset.state}
                              </span>
                            </div>
                          )}
                          {asset.country && (
                            <div>
                              <span className="text-zinc-500">Country: </span>
                              <span className="text-zinc-300">
                                {asset.country}
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
                          {asset.normalizedAddress && (
                            <div>
                              <span className="text-zinc-500">
                                Normalized Address:{" "}
                              </span>
                              <span className="text-zinc-300 font-mono text-xs">
                                {asset.normalizedAddress}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500">Created: </span>
                            <span className="text-zinc-300">
                              {new Date(asset.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Updated: </span>
                            <span className="text-zinc-300">
                              {new Date(asset.updatedAt).toLocaleString()}
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
