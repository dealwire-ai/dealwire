"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/hooks/use-api";

type BucketAction =
  | "REPLY_TO_SELF"
  | "DRAFT_REPLY_TO_BROKER"
  | "MOVE_TO_FOLDER"
  | "NONE";

interface Bucket {
  id: string;
  name: string;
  description: string;
  rank: number;
  isPass: boolean;
  action: BucketAction;
  folderName: string | null;
  generateSummary: boolean;
  color: string | null;
}

interface BucketForm {
  name: string;
  description: string;
  isPass: boolean;
  action: BucketAction;
  folderName: string;
  generateSummary: boolean;
  color: string;
}

const emptyForm: BucketForm = {
  name: "",
  description: "",
  isPass: true,
  action: "NONE",
  folderName: "",
  generateSummary: false,
  color: "",
};

const ACTION_LABELS: Record<BucketAction, string> = {
  REPLY_TO_SELF: "Reply to Self",
  DRAFT_REPLY_TO_BROKER: "Draft Reply to Broker",
  MOVE_TO_FOLDER: "Move to Folder",
  NONE: "None",
};

export default function ManagePage() {
  const { userId, isLoaded } = useAuth();
  const { apiCall } = useApi();

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BucketForm>(emptyForm);

  useEffect(() => {
    if (isLoaded && userId) {
      loadBuckets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  async function loadBuckets() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall("/screening-buckets");
      setBuckets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buckets");
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(bucket: Bucket) {
    setEditingId(bucket.id);
    setForm({
      name: bucket.name,
      description: bucket.description,
      isPass: bucket.isPass,
      action: bucket.action,
      folderName: bucket.folderName || "",
      generateSummary: bucket.generateSummary,
      color: bucket.color || "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        isPass: form.isPass,
        action: form.action,
        generateSummary: form.generateSummary,
      };
      if (form.action === "MOVE_TO_FOLDER") {
        body.folderName = form.folderName;
      } else {
        body.folderName = null;
      }
      if (form.color) {
        body.color = form.color;
      } else {
        body.color = null;
      }

      if (editingId) {
        await apiCall(`/screening-buckets/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiCall("/screening-buckets", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      cancelForm();
      await loadBuckets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save bucket");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this screening bucket?")) return;
    setError(null);
    try {
      await apiCall(`/screening-buckets/${id}`, { method: "DELETE" });
      await loadBuckets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete bucket");
    }
  }

  async function handleReorder(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= buckets.length) return;
    const newOrder = [...buckets];
    [newOrder[index], newOrder[swapIndex]] = [
      newOrder[swapIndex],
      newOrder[index],
    ];
    const bucketIds = newOrder.map((b) => b.id);
    // Optimistically update
    setBuckets(newOrder.map((b, i) => ({ ...b, rank: i + 1 })));
    try {
      await apiCall("/screening-buckets/reorder", {
        method: "PUT",
        body: JSON.stringify({ bucketIds }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder");
      await loadBuckets();
    }
  }

  if (!isLoaded) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Screening Buckets</h1>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-[#C8A96E] hover:bg-[#b8952a] text-black font-medium rounded-lg text-sm transition-colors"
          >
            + Add Bucket
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Bucket Form */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? "Edit Bucket" : "New Bucket"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#C8A96E]"
                    placeholder="e.g. Hot Deal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#C8A96E]"
                    placeholder="#C8A96E"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#C8A96E] resize-y"
                  placeholder="Criteria for AI classification into this bucket..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Action
                  </label>
                  <select
                    value={form.action}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action: e.target.value as BucketAction,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#C8A96E]"
                  >
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.action === "MOVE_TO_FOLDER" && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Folder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.folderName}
                      onChange={(e) =>
                        setForm({ ...form, folderName: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#C8A96E]"
                      placeholder="Passed Deals"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPass}
                    onChange={(e) =>
                      setForm({ ...form, isPass: e.target.checked })
                    }
                    className="accent-[#C8A96E]"
                  />
                  <span className="text-zinc-300">
                    Is Pass (Decision = YES)
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.generateSummary}
                    onChange={(e) =>
                      setForm({ ...form, generateSummary: e.target.checked })
                    }
                    className="accent-[#C8A96E]"
                  />
                  <span className="text-zinc-300">Generate Summary</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#C8A96E] hover:bg-[#b8952a] text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Bucket"}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Buckets Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-zinc-400">
              Loading buckets...
            </div>
          ) : buckets.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              No screening buckets found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 w-20">Pass?</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 w-20">Summary</th>
                  <th className="px-4 py-3 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, index) => (
                  <tr
                    key={bucket.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3 text-zinc-400">{bucket.rank}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {bucket.color && (
                          <span
                            className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                            style={{ backgroundColor: bucket.color }}
                          />
                        )}
                        {bucket.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                      {bucket.description}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          bucket.isPass
                            ? "bg-green-900/30 text-green-400"
                            : "bg-red-900/30 text-red-400"
                        }`}
                      >
                        {bucket.isPass ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {ACTION_LABELS[bucket.action]}
                      {bucket.folderName && (
                        <span className="text-zinc-500 ml-1">
                          ({bucket.folderName})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {bucket.generateSummary ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleReorder(index, "up")}
                          disabled={index === 0}
                          className="p-1 hover:bg-zinc-700 rounded disabled:opacity-20 transition-colors"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleReorder(index, "down")}
                          disabled={index === buckets.length - 1}
                          className="p-1 hover:bg-zinc-700 rounded disabled:opacity-20 transition-colors"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => startEdit(bucket)}
                          className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(bucket.id)}
                          disabled={buckets.length <= 1}
                          className="p-1 hover:bg-red-900/30 rounded disabled:opacity-20 transition-colors text-zinc-400 hover:text-red-400"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
