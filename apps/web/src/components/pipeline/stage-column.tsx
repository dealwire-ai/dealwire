"use client";

import { useDroppable } from "@dnd-kit/core";
import { DealCard } from "./deal-card";
import type { PipelineDeal, PipelineStage } from "./types";

interface StageColumnProps {
  stage: PipelineStage;
  deals: PipelineDeal[];
}

export function StageColumn({ stage, deals }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stageId: stage.id },
  });

  return (
    <div className="flex h-full w-[300px] flex-shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: stage.color ?? "#52525b" }}
          />
          <span className="truncate text-sm font-medium text-zinc-100">
            {stage.name}
          </span>
          {stage.isTerminal && (
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              Closed
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">{deals.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isOver ? "bg-zinc-800/40" : ""
        }`}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
