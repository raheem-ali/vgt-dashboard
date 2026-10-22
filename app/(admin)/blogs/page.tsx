"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { adminRequest, getStoredToken, SITE_URL } from "@/app/lib/properties-api";

interface AdminBlog {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string | null;
  read_time: number;
  read_time_manual: number | null;
  status: "published" | "draft";
  image: string | null;
  image_raw: string | null;
  intro: string[];
  sections: { id: string; heading: string; paragraphs: string[] }[];
  seo_title: string | null;
  seo_description: string | null;
}

interface Form {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published_at: string;
  read_time: string;
  status: "published" | "draft";
  intro: string;
  seo_title: string;
  seo_description: string;
}
interface SectionRow { heading: string; body: string }
interface Pick1 { raw: string; url: string; file: File | null; preview: string }

const EMPTY_PICK: Pick1 = { raw: "", url: "", file: null, preview: "" };
const EMPTY_FORM: Form = {
  title: "", slug: "", excerpt: "", category: "News", published_at: "", read_time: "",
  status: "published", intro: "", seo_title: "", seo_description: "",
};
const DEFAULT_CATEGORIES = ["News", "Investment", "Guides", "Mortgage", "Communities", "Business"];

const inputClass =
  "w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black text-black transition";
const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5";
const smallBtn =
  "text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 cursor-pointer";
const miniBtn =
  "text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer disabled:opacity-30 disabled:cursor-default";
const cardClass = "rounded-2xl border border-neutral-200 p-4 sm:p-5 bg-white";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "-";

export default function BlogsAdminPage() {
  const auth = useAuth() as unknown as { user: unknown; loading: boolean; token?: string | null };
  const { user, loading: authLoading } = auth;

  const [items, setItems] = useState<AdminBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<"published" | "draft">("draft");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [image, setImage] = useState<Pick1>(EMPTY_PICK);
  const [imageLink, setImageLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminBlog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getToken = useCallback(() => auth.token ?? getStoredToken(), [auth.token]);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await adminRequest<{ data: AdminBlog[] }>("/admin/blogs", { token: getToken() });
      setItems(res.data);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not load articles.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const categories = useMemo(
    () => Array.from(new Set([...DEFAULT_CATEGORIES, ...items.map((i) => i.category)])),
    [items],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (catFilter !== "all" && p.category !== catFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [items, search, catFilter]);

  function releasePreview() {
    if (image.preview) URL.revokeObjectURL(image.preview);
  }

  function closeModal() {
    releasePreview();
    setModalOpen(false);
  }

  function openAdd() {
    releasePreview();
    setEditingId(null);
    setEditingStatus("draft");
    setForm({ ...EMPTY_FORM, published_at: new Date().toISOString().slice(0, 10) });
    setSections([]);
    setImage(EMPTY_PICK);
    setImageLink("");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(p: AdminBlog) {
    releasePreview();
    setEditingId(p.id);
    setEditingStatus(p.status);
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      category: p.category,
      published_at: p.date ?? "",
      read_time: p.read_time_manual ? String(p.read_time_manual) : "",
      status: p.status,
      intro: (p.intro ?? []).join("\n\n"),
      seo_title: p.seo_title ?? "",
      seo_description: p.seo_description ?? "",
    });
    setSections((p.sections ?? []).map((s) => ({ heading: s.heading, body: s.paragraphs.join("\n\n") })));
    setImage(p.image_raw && p.image ? { raw: p.image_raw, url: p.image, file: null, preview: "" } : EMPTY_PICK);
    setImageLink("");
    setFormError("");
    setModalOpen(true);
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function moveSection(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  }

  function patchSection(i: number, p: Partial<SectionRow>) {
    setSections((l) => l.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (image.file && image.file.size > 4 * 1024 * 1024) {
      setFormError("Image is larger than 4 MB.");
      return;
    }

    const body = new FormData();
    (Object.keys(form) as (keyof Form)[]).forEach((k) => body.append(k, form[k]));
    body.set("sections", JSON.stringify(sections));
    body.set("image", image.file ? "" : image.raw);
    if (image.file) body.set("image_file", image.file);

    setSaving(true);
    try {
      await adminRequest(editingId ? `/admin/blogs/${editingId}` : "/admin/blogs", {
        method: "POST",
        body,
        token: getToken(),
      });
      closeModal();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the article.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminRequest(`/admin/blogs/${deleteTarget.id}`, { method: "DELETE", token: getToken() });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not delete the article.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const shownImage = image.preview || image.url;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">Blogs</h1>
          <p className="text-sm text-neutral-500 mt-1">Articles added here appear on the website Blogs page.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition shadow-md cursor-pointer"
        >
          + Add Article
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm p-4 sm:p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Search title or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={`${inputClass} cursor-pointer`}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {pageError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{pageError}</div>
      )}

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-500">Loading articles...</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">
            {items.length === 0 ? "No articles yet. Click “Add Article” to create the first one." : "No articles match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-4 font-bold">Article</th>
                  <th className="px-5 py-4 font-bold">Category</th>
                  <th className="px-5 py-4 font-bold">Date</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4 min-w-[260px]">
                        <div className="w-16 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                          {p.image && <img src={p.image} alt={p.title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-900 truncate max-w-[320px]">{p.title}</div>
                          <div className="text-xs text-neutral-500 truncate max-w-[320px]">/{p.slug} · {p.read_time} min</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="bg-neutral-100 text-neutral-800 font-semibold text-xs px-3 py-1.5 rounded-lg">{p.category}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-neutral-700">{fmtDate(p.date)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                          p.status === "published" ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {p.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      {p.status === "published" && (
                        <a
                          href={`${SITE_URL}/blogs/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-neutral-300 hover:border-black transition cursor-pointer mr-2 inline-block"
                        >
                          Preview
                        </a>
                      )}
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-neutral-300 hover:border-black transition cursor-pointer mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 overflow-y-auto p-3 sm:p-8">
          <form onSubmit={save} className="bg-white rounded-[24px] shadow-2xl max-w-[900px] mx-auto">
            <div className="flex items-start justify-between gap-4 p-6 sm:p-8 pb-4">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-neutral-900">{editingId ? "Edit Article" : "Add Article"}</h2>
                <p className="text-xs text-neutral-500 mt-1">Separate paragraphs with a blank line.</p>
              </div>
              <div className="flex items-center gap-2">
                {editingId && editingStatus === "published" && (
                  <a href={`${SITE_URL}/blogs/${form.slug}`} target="_blank" rel="noopener noreferrer" className={smallBtn}>
                    Preview ↗
                  </a>
                )}
                <button type="button" onClick={closeModal} className="w-9 h-9 rounded-full border border-neutral-300 hover:border-black flex items-center justify-center cursor-pointer" aria-label="Close">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 pt-2 space-y-5">
              <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                <div className="md:col-span-2">
                  <label className={labelClass}>Title *</label>
                  <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} placeholder="How Property Gets You a Golden Visa" />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input list="blog-categories" value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass} placeholder="Guides" />
                  <datalist id="blog-categories">
                    {categories.map((c) => (<option key={c} value={c} />))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value as "published" | "draft")} className={`${inputClass} cursor-pointer`}>
                    <option value="published">Published (visible on website)</option>
                    <option value="draft">Draft (hidden)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Publish date</label>
                  <input type="date" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Read time (minutes, optional)</label>
                  <input type="number" min="1" max="180" value={form.read_time} onChange={(e) => set("read_time", e.target.value)} className={inputClass} placeholder="Auto from the text" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Link name (slug, optional)</label>
                  <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputClass} placeholder="Built from the title when empty" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Short summary (shown on cards)</label>
                  <textarea rows={3} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={inputClass} placeholder="Leave empty to use the start of the introduction" />
                </div>
              </div>

              <div className={cardClass}>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Featured image</h3>
                <p className="text-xs text-neutral-500 mt-1">Shown on the cards and at the top of the article.</p>
                <div className="flex flex-col sm:flex-row gap-4 mt-3 items-start">
                  {shownImage && (
                    <div className="relative w-44 aspect-[16/9] rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                      <img src={shownImage} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { releasePreview(); setImage(EMPTY_PICK); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 text-white text-xs cursor-pointer"
                        aria-label="Remove image"
                      >✕</button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 w-full">
                    <div>
                      <label className={labelClass}>Upload (max 4 MB)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          releasePreview();
                          setImage({ raw: "", url: "", file, preview: URL.createObjectURL(file) });
                          e.target.value = "";
                        }}
                        className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-black file:text-white file:px-4 file:py-2.5 file:text-xs file:font-bold file:uppercase file:cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Or paste a link</label>
                      <div className="flex gap-2">
                        <input value={imageLink} onChange={(e) => setImageLink(e.target.value)} className={inputClass} placeholder="https://..." />
                        <button
                          type="button"
                          onClick={() => {
                            const v = imageLink.trim();
                            if (!/^https?:\/\//i.test(v)) {
                              setFormError("Image link must start with http:// or https://");
                              return;
                            }
                            setFormError("");
                            releasePreview();
                            setImage({ raw: v, url: v, file: null, preview: "" });
                            setImageLink("");
                          }}
                          className="bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase px-4 rounded-xl cursor-pointer"
                        >Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Introduction</h3>
                <p className="text-xs text-neutral-500 mt-1 mb-3">The first paragraph is shown larger.</p>
                <textarea rows={7} value={form.intro} onChange={(e) => set("intro", e.target.value)} className={inputClass} placeholder={"First paragraph...\n\nSecond paragraph..."} />
              </div>

              <div className={cardClass}>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Sections</h3>
                <p className="text-xs text-neutral-500 mt-1 mb-4">Numbered sections (01, 02...). They also build the “In this article” list. Sections without a heading are dropped.</p>
                <div className="space-y-3">
                  {sections.map((s, i) => (
                    <div key={i} className="rounded-xl border border-neutral-200 p-3 bg-neutral-50/60">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0 space-y-2">
                          <input value={s.heading} onChange={(e) => patchSection(i, { heading: e.target.value })} className={inputClass} placeholder={`Section ${i + 1} heading`} />
                          <textarea rows={6} value={s.body} onChange={(e) => patchSection(i, { body: e.target.value })} className={inputClass} placeholder="Paragraphs, separated by a blank line" />
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <div className="flex gap-1.5">
                            <button type="button" className={miniBtn} disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="Move up">↑</button>
                            <button type="button" className={miniBtn} disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="Move down">↓</button>
                          </div>
                          <button type="button" className={`${miniBtn} text-red-600`} onClick={() => setSections((l) => l.filter((_, idx) => idx !== i))}>Remove</button>
                        </div>
                      </div>
                      {!s.heading.trim() && s.body.trim() && <p className="text-xs text-red-600 mt-2">Add a heading or this section is dropped.</p>}
                    </div>
                  ))}
                </div>
                <button type="button" disabled={sections.length >= 30} onClick={() => setSections((l) => [...l, { heading: "", body: "" }])} className={`${smallBtn} mt-3 disabled:opacity-40`}>
                  + Add section
                </button>
              </div>

              <div className={`${cardClass} grid grid-cols-1 gap-4`}>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">SEO (optional)</h3>
                <div>
                  <label className={labelClass}>Page title</label>
                  <input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} className={inputClass} placeholder={form.title || "Defaults to the article title"} />
                </div>
                <div>
                  <label className={labelClass}>Meta description</label>
                  <textarea rows={2} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} className={inputClass} placeholder="Defaults to the short summary" />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-neutral-200 rounded-b-[24px] px-6 sm:px-8 py-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-3">{formError}</div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-6 py-3.5 rounded-xl border border-neutral-300 hover:border-black text-xs font-bold uppercase tracking-wider cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-black hover:bg-neutral-800 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl shadow-md cursor-pointer">
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Article"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-[440px] w-full p-6 sm:p-8">
            <h3 className="text-lg font-extrabold text-neutral-900">Delete this article?</h3>
            <p className="text-sm text-neutral-600 mt-2">
              “{deleteTarget.title}” will be removed from the website, along with its uploaded image. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-3 rounded-xl border border-neutral-300 hover:border-black text-xs font-bold uppercase tracking-wider cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider cursor-pointer">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}