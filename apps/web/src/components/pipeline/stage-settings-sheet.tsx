"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import type { PipelineStage } from "./types";

interface StageSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  onStagesChanged: () => void | Promise<void>;
}

export function StageSettingsSheet({
  open,
  onOpenChange,
  stages,
  onStagesChanged,
}: StageSettingsSheetProps) {
  const { apiCall } = useApi();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#94a3b8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-stage local state for the in-row delete-with-replacement picker.
  const [pendingDelete, setPendingDelete] = useState<{
    stageId: string;
    replacementId: string;
  } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiCall("/public-data/crm/stages", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      setNewName("");
      await onStagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stage");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (
    id: string,
    body: Partial<{
      name: string;
      color: string;
      isDefault: boolean;
      isTerminal: boolean;
    }>,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await apiCall(`/public-data/crm/stages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await onStagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (stageId: string, replacementId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiCall(
        `/public-data/crm/stages/${stageId}?replacementStageId=${replacementId}`,
        { method: "DELETE" },
      );
      setPendingDelete(null);
      await onStagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete stage");
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = async (stageId: string, direction: -1 | 1) => {
    const idx = stages.findIndex((s) => s.id === stageId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= stages.length) return;
    const orderedIds = stages.map((s) => s.id);
    [orderedIds[idx], orderedIds[swap]] = [orderedIds[swap], orderedIds[idx]];
    setBusy(true);
    setError(null);
    try {
      await apiCall("/public-data/crm/stages/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds }),
      });
      await onStagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Pipeline stages</SheetTitle>
          <SheetDescription>
            Reorder, rename, and recolor your pipeline columns. The default
            stage is where new deals land.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="rounded border border-red-900 bg-red-950/30 p-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto">
          {stages.map((stage, idx) => {
            const isPendingDelete = pendingDelete?.stageId === stage.id;
            return (
              <div
                key={stage.id}
                className="rounded border border-zinc-800 bg-zinc-900/50 p-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={idx === 0 || busy}
                      onClick={() => handleReorder(stage.id, -1)}
                      className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === stages.length - 1 || busy}
                      onClick={() => handleReorder(stage.id, 1)}
                      className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>

                  <input
                    type="color"
                    value={stage.color ?? "#94a3b8"}
                    onChange={(e) =>
                      handleUpdate(stage.id, { color: e.target.value })
                    }
                    disabled={busy}
                    className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
                    aria-label="Stage color"
                  />

                  <Input
                    defaultValue={stage.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== stage.name)
                        handleUpdate(stage.id, { name: v });
                    }}
                    disabled={busy}
                    className="h-7 flex-1"
                  />

                  <button
                    type="button"
                    onClick={() => handleUpdate(stage.id, { isDefault: true })}
                    disabled={busy || stage.isDefault}
                    title={
                      stage.isDefault
                        ? "Default stage"
                        : "Make default for new deals"
                    }
                    className={`text-zinc-500 hover:text-amber-300 disabled:opacity-100 ${
                      stage.isDefault ? "text-amber-400" : ""
                    }`}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={stage.isDefault ? "currentColor" : "none"}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete(
                        isPendingDelete
                          ? null
                          : {
                              stageId: stage.id,
                              replacementId:
                                stages.find((s) => s.id !== stage.id)?.id ?? "",
                            },
                      )
                    }
                    disabled={busy || stage.isDefault}
                    title={
                      stage.isDefault
                        ? "Promote another stage to default before deleting"
                        : "Delete stage"
                    }
                    className="text-zinc-500 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isPendingDelete && pendingDelete && (
                  <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                    <label className="block text-xs text-zinc-400">
                      Move existing deals on this stage to:
                    </label>
                    <Select
                      value={pendingDelete.replacementId}
                      onValueChange={(v) =>
                        setPendingDelete({ ...pendingDelete, replacementId: v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages
                          .filter((s) => s.id !== stage.id)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDelete(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-950/60"
                        disabled={!pendingDelete.replacementId || busy}
                        onClick={() =>
                          handleDelete(
                            pendingDelete.stageId,
                            pendingDelete.replacementId,
                          )
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <label className="block text-xs text-zinc-400">Add stage</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent"
              aria-label="New stage color"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Stage name"
              className="flex-1"
            />
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || busy}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
