"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/hooks/use-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface FieldMapEntry {
  name: string;
  description: string;
  sheet: string;
  cell: string;
}

interface Proforma {
  id: string;
  name: string;
  s3Key: string;
  fieldMap: FieldMapEntry[];
  isDefault: boolean;
  isReady: boolean;
  createdAt: string;
  updatedAt: string;
}

function FieldMapEditor({
  fieldMap,
  onChange,
}: {
  fieldMap: FieldMapEntry[];
  onChange: (updated: FieldMapEntry[]) => void;
}) {
  const addRow = () => {
    onChange([...fieldMap, { name: "", description: "", sheet: "", cell: "" }]);
  };

  const updateRow = (i: number, patch: Partial<FieldMapEntry>) => {
    const updated = fieldMap.map((row, idx) =>
      idx === i ? { ...row, ...patch } : row,
    );
    onChange(updated);
  };

  const removeRow = (i: number) => {
    onChange(fieldMap.filter((_, idx) => idx !== i));
  };

  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-400 mb-2">Fields</p>
      {fieldMap.length === 0 && (
        <p className="text-xs text-zinc-600 mb-2">
          No fields yet. Add a field or upload a template to auto-discover them.
        </p>
      )}
      {fieldMap.length > 0 && (
        <div className="space-y-1 mb-3">
          {fieldMap.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="Field name"
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs w-36 flex-shrink-0"
                  />
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(i, { description: e.target.value })
                    }
                    placeholder="Description"
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs flex-1 min-w-0"
                  />
                </div>
                {(row.sheet || row.cell) && (
                  <div className="flex items-center gap-2 pl-0.5">
                    <input
                      value={row.sheet}
                      onChange={(e) => updateRow(i, { sheet: e.target.value })}
                      placeholder="Sheet"
                      className="bg-transparent border border-zinc-800 rounded px-2 py-0.5 text-zinc-500 text-xs w-36 flex-shrink-0"
                    />
                    <input
                      value={row.cell}
                      onChange={(e) => updateRow(i, { cell: e.target.value })}
                      placeholder="Cell"
                      className="bg-transparent border border-zinc-800 rounded px-2 py-0.5 text-zinc-500 text-xs w-20 flex-shrink-0"
                    />
                    <span className="text-xs text-zinc-700">cell ref</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeRow(i)}
                className="text-zinc-500 hover:text-red-400 px-2 flex-shrink-0 mt-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={addRow}
        className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
      >
        + Add Field
      </button>
    </div>
  );
}

function ProformaCard({
  proforma,
  onUpdate,
  onDelete,
  token,
}: {
  proforma: Proforma;
  onUpdate: (updated: Proforma) => void;
  onDelete: (id: string) => void;
  token: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editName, setEditName] = useState(proforma.name);
  const [editIsDefault, setEditIsDefault] = useState(proforma.isDefault);
  const [editIsReady, setEditIsReady] = useState(proforma.isReady);
  const [editFieldMap, setEditFieldMap] = useState<FieldMapEntry[]>(
    Array.isArray(proforma.fieldMap) ? proforma.fieldMap : [],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldCount = Array.isArray(proforma.fieldMap)
    ? proforma.fieldMap.length
    : 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/underwriting/proforma/${proforma.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            name: editName,
            isDefault: editIsDefault,
            isReady: editIsReady,
            fieldMap: editFieldMap,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      onUpdate(updated);
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${proforma.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_URL}/underwriting/proforma/${proforma.id}`,
        {
          method: "DELETE",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      onDelete(proforma.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{proforma.name}</span>
          {proforma.isDefault && (
            <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full border border-blue-800">
              Default
            </span>
          )}
          {proforma.isReady && (
            <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded-full border border-green-800">
              Ready
            </span>
          )}
          {!proforma.isReady && (
            <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded-full border border-yellow-800">
              Draft
            </span>
          )}
          {fieldCount > 0 && (
            <span className="text-xs text-zinc-500">
              {fieldCount} field{fieldCount !== 1 ? "s" : ""} discovered
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
          >
            {expanded ? "Cancel" : fieldCount > 0 ? "Review Fields" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-red-900/50 rounded text-zinc-400 hover:text-red-400 transition-colors"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm w-full max-w-sm"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={editIsDefault}
                onChange={(e) => setEditIsDefault(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Set as default template
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={editIsReady}
                onChange={(e) => setEditIsReady(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Mark as ready
            </label>
          </div>
          <FieldMapEditor fieldMap={editFieldMap} onChange={setEditFieldMap} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function UnderwritingPage() {
  const { userId, isLoaded, getToken } = useAuth();
  const { apiCall } = useApi();

  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    getToken().then(setToken);
  }, [isLoaded, userId, getToken]);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    apiCall("/underwriting/proforma")
      .then((data) => setProformas(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!newFile) {
      setCreateError("Select a .xlsx file");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const tok = await getToken();
      const form = new FormData();
      form.append("name", newName.trim());
      form.append("file", newFile);
      const res = await fetch(`${API_URL}/underwriting/proforma`, {
        method: "POST",
        headers: { ...(tok && { Authorization: `Bearer ${tok}` }) },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setProformas((prev) => [created, ...prev]);
      setNewName("");
      setNewFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Underwriting Templates</h1>
        </div>

        {/* Create form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Template</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name (e.g. Standard Multifamily)"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm placeholder:text-zinc-500"
            />
            <label className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors">
              <span>{newFile ? newFile.name : "Choose .xlsx file"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {creating ? "Scanning template..." : "Create"}
            </button>
          </div>
          {createError && (
            <p className="text-xs text-red-400 mt-2">{createError}</p>
          )}
        </div>

        {/* Template list */}
        {loading ? (
          <div className="text-zinc-400 py-8 text-center">
            Loading templates...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400">
            {error}
          </div>
        ) : proformas.length === 0 ? (
          <div className="text-zinc-500 py-8 text-center">
            No templates yet. Upload a .xlsx proforma above.
          </div>
        ) : (
          <div className="space-y-3">
            {proformas.map((p) => (
              <ProformaCard
                key={p.id}
                proforma={p}
                token={token}
                onUpdate={(updated) =>
                  setProformas((prev) =>
                    prev.map((x) => (x.id === updated.id ? updated : x)),
                  )
                }
                onDelete={(id) =>
                  setProformas((prev) => prev.filter((x) => x.id !== id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
