"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { DealCard } from "./deal-card";
import { StageColumn } from "./stage-column";
import { StageSettingsSheet } from "./stage-settings-sheet";
import type {
  PipelineDeal,
  PipelineDealsResponse,
  PipelineStage,
  PipelineStagesResponse,
} from "./types";

export function PipelineBoard() {
  const { apiCall } = useApi();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pointer sensor with a small drag distance so card clicks don't immediately
  // start a drag (lets us add click-to-open later without conflict).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stageRes, dealRes] = await Promise.all([
        apiCall("/public-data/crm/stages") as Promise<PipelineStagesResponse>,
        apiCall("/public-data/crm/deals") as Promise<PipelineDealsResponse>,
      ]);
      setStages(stageRes.stages);
      setDeals(dealRes.deals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group deals by stage for column rendering. Re-derives only when source changes.
  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of deals) {
      const list = map.get(deal.stageId);
      if (list) list.push(deal);
    }
    return map;
  }, [stages, deals]);

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const toStageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === toStageId) return;

    const targetStage = stages.find((s) => s.id === toStageId);
    if (!targetStage) return;

    // Optimistic move; rollback on API error.
    const prevStageId = deal.stageId;
    setDeals((current) =>
      current.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stageId: toStageId,
              stage: {
                id: targetStage.id,
                name: targetStage.name,
                color: targetStage.color,
                isTerminal: targetStage.isTerminal,
              },
            }
          : d,
      ),
    );

    try {
      await apiCall(`/public-data/crm/deals/${deal.parcel.bbl}/stage`, {
        method: "POST",
        body: JSON.stringify({ stageId: toStageId }),
      });
    } catch {
      const prevStage = stages.find((s) => s.id === prevStageId);
      setDeals((current) =>
        current.map((d) =>
          d.id === dealId && prevStage
            ? {
                ...d,
                stageId: prevStageId,
                stage: {
                  id: prevStage.id,
                  name: prevStage.name,
                  color: prevStage.color,
                  isTerminal: prevStage.isTerminal,
                },
              }
            : d,
        ),
      );
      setError("Couldn't move deal — change reverted");
    }
  };

  if (loading && stages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading pipeline…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-100">Pipeline</h1>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Stages
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage.get(stage.id) ?? []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <StageSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        stages={stages}
        onStagesChanged={load}
      />
    </div>
  );
}
