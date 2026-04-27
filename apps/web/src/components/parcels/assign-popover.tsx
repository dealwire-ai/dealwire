"use client";

import { useState } from "react";
import { Check, X, UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";

export interface OrgMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function memberDisplayName(member: OrgMember): string {
  const full = [member.firstName, member.lastName].filter(Boolean).join(" ");
  return full || member.email;
}

interface AssignPopoverProps {
  bbl: string;
  members: OrgMember[];
  currentAssignee: OrgMember | null;
  onAssigned: (member: OrgMember | null) => void;
}

export function AssignPopover({
  bbl,
  members,
  currentAssignee,
  onAssigned,
}: AssignPopoverProps) {
  const { apiCall } = useApi();
  const [open, setOpen] = useState(false);

  async function handleSelect(member: OrgMember | null) {
    setOpen(false);
    const prev = currentAssignee;
    onAssigned(member);
    try {
      await apiCall(`/public-data/crm/deals/${bbl}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedToUserId: member?.id ?? null }),
      });
    } catch {
      onAssigned(prev);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {currentAssignee ? (
            <AssigneeBadge member={currentAssignee} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-zinc-400">
              <UserPlus className="h-3 w-3" />
              Assign
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] border-zinc-800 bg-zinc-950 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-0.5">
          {members.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-zinc-500">
              No teammates yet
            </div>
          )}
          {members.map((member) => {
            const isActive = currentAssignee?.id === member.id;
            return (
              <button
                key={member.id}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/50"
                onClick={() => handleSelect(member)}
              >
                <span className="text-zinc-200">
                  {memberDisplayName(member)}
                </span>
                {isActive && (
                  <Check className="ml-auto h-3.5 w-3.5 text-zinc-400" />
                )}
              </button>
            );
          })}
          {currentAssignee && (
            <>
              <div className="my-1 border-t border-zinc-800" />
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-400"
                onClick={() => handleSelect(null)}
              >
                <X className="h-3 w-3" />
                Unassign
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AssigneeBadge({ member }: { member: OrgMember }) {
  const initials =
    (
      (member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "")
    ).toUpperCase() || "??";
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-semibold text-zinc-200">
        {initials}
      </span>
      {memberDisplayName(member)}
    </span>
  );
}
