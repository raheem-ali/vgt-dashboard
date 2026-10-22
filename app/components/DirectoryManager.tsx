"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { adminRequest, getStoredToken } from "@/app/lib/properties-api";

/* One manager used by both the Developers and Communities dashboard pages. */

interface Item {
  id: number;
  name: string;
  slug: string;
  short_name?: string | null;
  city?: string;
  tagline?: string | null;
  description: string | null;
  logo?: string | null;
  image?: string | null;
  featured: boolean;
  status: "published" | "draft";
  properties: number;
}

const inputClass =
  "w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black text-black transition";
const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5";

const EMPTY = { name: "", short_name: "", city: "Dubai", tagline: "", description: "", is_featured: false, status: "published" as "published" | "draft" };

export default function DirectoryManager({ resource }: { resource: "developers" | "communities" }) {
  const isDev = resource === "developers";
  const noun = isDev ? "Developer" : "Community";
  const auth = useAuth() as unknown as { user: unknown; loading: boolean; token?: string | null };
  const getToken = useCallback(() => auth.token ?? getStoredToken(), [auth.token]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await adminRequest<{ data: Item[] }>(`/admin/directory/${resource}`, { token: getToken() });
      setItems(res.data);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not load the list.");
    } finally {
      setLoading(false);
    }
  }, [resource, getToken]);

  useEffect(() => {
    if (!auth.loading && auth.user) load();
  }, [auth.loading, auth.user, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => !q || `${i.name} ${i.city ?? ""}`.toLowerCase().includes(q));
  }, [items, search]);

  const currentImage = editing ? (isDev ? editing.logo : editing.image) : null;

  function openForm(item: Item | null) {
    setEditing(item);
    setForm(
      item
        ? {
            name: item.name,
            short_name: item.short_name ?? "",
            city: item.city ?? "Dubai",
            tagline: item.tagline ?? "",
            description: item.description ?? "",
            is_featured: item.featured,
            status: item.status,
          }
        : EMPTY,
    );
    setImageUrl("");
    setFile(null);
    setRemoveImage(false);
    setFormError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      setFormError("Image link must start with http:// or https://");
      return;
    }
    const body = new FormData();
    body.set("name", form.name);
    body.set("description", form.description);
    body.set("is_featured", form.is_featured ? "1" : "0");
    body.set("status", form.status);
    if (isDev) body.set("short_name", form.short_name);
    else {
      body.set("city", form.city);
      body.set("tagline", form.tagline);
    }
    if (file) body.set("image_file", file);
    else if (imageUrl) body.set("image_url", imageUrl);
    else if (removeImage) body.set("remove_image", "1");

    setSaving(true);
    try {
      await adminRequest(`/admin/directory/${resource}${editing ? `/${editing.id}` : ""}`, {
        method: "POST",
        body,
        token: getToken(),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await adminRequest(`/admin/directory/${resource}/${deleteTarget.id}`, { method: "DELETE", token: getToken() });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not delete.");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">{isDev ? "Developers" : "Communities"}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {isDev
              ? "Shown on the Developers page. The property count is worked out from listings whose Developer field matches the name or short name."
              : "Shown on the Communities page. The property count is worked out from listings whose Location contains the community name."}
          </p>
        </div>
        <button onClick={() => openForm(null)} className="bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition shadow-md cursor-pointer">
          + Add {noun}
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm p-4 sm:p-5 mb-6">
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} />
      </div>

      {pageError && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{pageError}</div>}

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-sm text-neutral-400">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-400">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map((i) => {
              const img = isDev ? i.logo : i.image;
              return (
                <li key={i.id} className="flex items-center gap-4 p-4 sm:p-5">
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] text-neutral-400">
                    {img ? <img src={img} alt="" className={`w-full h-full ${isDev ? "object-contain p-1" : "object-cover"}`} /> : "No image"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-900 truncate">{i.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {isDev ? i.short_name || "-" : i.city} · {i.properties} properties
                    </p>
                    <div className="flex gap-2 mt-1.5">
                      {i.featured && <span className="text-[10px] font-bold uppercase bg-black text-white px-2 py-0.5 rounded-full">Featured</span>}
                      {i.status === "draft" && <span className="text-[10px] font-bold uppercase bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">Draft</span>}
                    </div>
                  </div>
                  <button onClick={() => openForm(i)} className="text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 cursor-pointer">Edit</button>
                  <button onClick={() => setDeleteTarget(i)} className="text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer">Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <form onSubmit={save} className="bg-white rounded-[24px] w-full max-w-xl p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-extrabold text-neutral-900">{editing ? `Edit ${noun}` : `Add ${noun}`}</h2>

            <div>
              <label className={labelClass}>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder={isDev ? "Emaar Properties" : "Dubai Hills Estate"} />
            </div>

            {isDev ? (
              <div>
                <label className={labelClass}>Short name used on listings</label>
                <input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} className={inputClass} placeholder="EMAAR" />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>City *</label>
                  <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} placeholder="Dubai" />
                </div>
                <div>
                  <label className={labelClass}>Tagline (featured cards)</label>
                  <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={inputClass} placeholder="Waterside Living" />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Description</label>
              <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{isDev ? "Logo" : "Image"}</label>
              {currentImage && !removeImage && !file && !imageUrl && (
                <div className="flex items-center gap-3 mb-2">
                  <img src={currentImage} alt="" className="w-16 h-16 rounded-xl object-contain bg-neutral-100 border border-neutral-200" />
                  <button type="button" onClick={() => setRemoveImage(true)} className="text-xs font-bold text-red-600 underline cursor-pointer">Remove</button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm mb-2" />
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} placeholder="...or paste an image link https://" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "published" | "draft" })} className={`${inputClass} cursor-pointer`}>
                  <option value="published">Published</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold mt-6 cursor-pointer">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="w-4 h-4" />
                Featured
              </label>
            </div>

            {formError && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{formError}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-5 py-3 rounded-xl border border-neutral-300 text-xs font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button disabled={saving} className="px-6 py-3 rounded-xl bg-black text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 text-center">
            <p className="font-bold text-neutral-900 mb-1">Delete {deleteTarget.name}?</p>
            <p className="text-sm text-neutral-500 mb-5">Listings are not deleted, only this {noun.toLowerCase()} entry.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-3 rounded-xl border border-neutral-300 text-xs font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-3 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
