"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";
import { type OrgMember, memberDisplayName } from "./assign-popover";

interface BatchAssignButtonProps {
  selectedBbls: Set<string>;
  members: OrgMember[];
  onAssigned: (member: OrgMember | null) => void;
}

export function BatchAssignButton({
  selectedBbls,
  members,
  onAssigned,
}: BatchAssignButtonProps) {
  const { apiCall } = useApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSelect(member: OrgMember | null) {
    setOpen(false);
    setLoading(true);
    onAssigned(member);
    try {
      await apiCall("/public-data/crm/deals/bulk-assign", {
        method: "POST",
        body: JSON.stringify({
          bbls: Array.from(selectedBbls),
          assignedToUserId: member?.id ?? null,
        }),
      });
    } catch {
      // Optimistic update already applied; user can retry if needed.
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={loading}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {loading ? "Assigning…" : `Assign ${selectedBbls.size}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] border-zinc-800 bg-zinc-950 p-1"
        align="start"
      >
        <div className="space-y-0.5">
          {members.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-zinc-500">
              No teammates yet
            </div>
          )}
          {members.map((member) => (
            <button
              key={member.id}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/50"
              onClick={() => handleSelect(member)}
            >
              <span className="text-zinc-200">{memberDisplayName(member)}</span>
            </button>
          ))}
          <div className="my-1 border-t border-zinc-800" />
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-400"
            onClick={() => handleSelect(null)}
          >
            <X className="h-3 w-3" />
            Unassign
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
