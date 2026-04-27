"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/parcels/score-badge";
import { BOROUGH_LABELS } from "./constants";
import type { PipelineDeal } from "./types";

interface DealCardProps {
  deal: PipelineDeal;
  isDragOverlay?: boolean;
}

export function DealCard({ deal, isDragOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id, data: { stageId: deal.stageId } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  const assigneeName = deal.assignedToUser
    ? [deal.assignedToUser.firstName, deal.assignedToUser.lastName]
        .filter(Boolean)
        .join(" ") || deal.assignedToUser.email
    : null;

  // Hide the original card while it's being dragged (DragOverlay renders a copy).
  if (isDragging && !isDragOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-3 opacity-40"
      >
        <div className="h-20" />
      </div>
    );
  }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      className={`group cursor-grab rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm shadow-sm transition-colors hover:border-zinc-700 active:cursor-grabbing ${
        isDragOverlay ? "rotate-2 cursor-grabbing shadow-xl" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-100">
            {deal.parcel.address || `BBL ${deal.parcel.bbl}`}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {BOROUGH_LABELS[deal.parcel.borough] ?? deal.parcel.borough}
            {deal.parcel.zipCode ? ` · ${deal.parcel.zipCode}` : ""}
            {deal.parcel.buildingClass
              ? ` · Class ${deal.parcel.buildingClass}`
              : ""}
          </div>
        </div>
        <ScoreBadge score={deal.parcel.distressScore} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        {assigneeName ? (
          <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300">
            {assigneeName}
          </Badge>
        ) : (
          <span className="text-zinc-600">Unassigned</span>
        )}
        {deal.nextFollowUpAt && (
          <span className="text-zinc-500">
            {new Date(deal.nextFollowUpAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
