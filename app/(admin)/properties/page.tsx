"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  adminRequest,
  fetchPublicList,
  getStoredToken,
  SITE_URL,
  type AdminProperty,
  type DirectoryRef,
  type ListingType,
  type MpRow,
  type PayPlan,
  type PerkRow,
  type StatRow,
} from "@/app/lib/properties-api";

const LISTING_LABELS: Record<ListingType, string> = {
  buy: "Buy",
  rent: "Rent",
  ready: "Ready To Move In",
  offplan: "Off-Plan",
};

const PROPERTY_TYPES = ["Villa", "Townhouse", "Apartment", "Penthouse", "Studio", "Land", "Commercial"];
const UNIT_TYPES = ["Townhouse", "Villa", "Apartment", "Penthouse", "Studio"];
const FALLBACK_DEVELOPERS = ["EMAAR", "ALDAR", "DAMAC", "Danube", "Sobha", "Binghatti", "Azizi", "Ellington", "Nakheel", "Meraas", "Nshama"];
const STATUSES = ["", "Available", "Limited", "Sold out"];

/** Plain text columns edited as simple inputs. */
const EXTRA_TEXT = [
  "hero_eyebrow", "hero_title", "hero_subtitle", "hero_btn1_label", "hero_btn1_target", "hero_btn2_label", "hero_btn2_target",
  "mp_label", "mp_heading", "mp_intro", "mp_caption", "mp_list_title", "mp_footnote", "breadcrumb",
  "offers_heading", "offers_footnote",
  "story_label", "story_heading", "story_caption", "story_btn_label", "story_btn_link",
  "res_label", "res_heading", "res_intro", "res_btn_label", "res_btn_target",
  "amenities_label", "amenities_heading", "amenities_intro", "amenities_btn_label", "amenities_btn_link",
  "pay_label",
  "related_label", "related_heading",
  "enq_label", "enq_heading", "enq_intro", "enq_email", "enq_privacy",
  "seo_title", "seo_description",
] as const;
type ExtraKey = (typeof EXTRA_TEXT)[number];

interface CoreForm {
  title: string;
  listing_type: ListingType;
  property_type: string;
  location: string;
  developer: string;
  developer_id: string;
  community_id: string;
  price: string;
  price_period: string;
  bedrooms: string;
  bathrooms: string;
  area_sq_ft: string;
  tagline: string;
  handover_date: string;
  description: string;
  phone: string;
  whatsapp: string;
  is_featured: boolean;
  status: "published" | "draft";
  related_mode: "auto" | "manual";
}
type FormState = CoreForm & Record<ExtraKey, string>;
type StrKey = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState];

const EMPTY_EXTRA = Object.fromEntries(EXTRA_TEXT.map((k) => [k, ""])) as Record<ExtraKey, string>;
const EMPTY_FORM: FormState = {
  title: "",
  listing_type: "buy",
  property_type: "Villa",
  location: "",
  developer: "",
  developer_id: "",
  community_id: "",
  price: "",
  price_period: "Year",
  bedrooms: "",
  bathrooms: "",
  area_sq_ft: "",
  tagline: "",
  handover_date: "",
  description: "",
  phone: "+971545834608",
  whatsapp: "+971545834608",
  is_featured: false,
  status: "published",
  related_mode: "auto",
  ...EMPTY_EXTRA,
};

const TABS = [
  ["basics", "Basics"],
  ["hero", "Hero"],
  ["gallery", "Gallery & Master plan"],
  ["story", "Highlights & Story"],
  ["units", "Unit types & Prices"],
  ["stats", "Stats"],
  ["amenities", "Amenities"],
  ["payment", "Payment plans"],
  ["faqs", "FAQs"],
  ["related", "Related"],
  ["enquiry", "Enquiry section"],
  ["seo", "SEO"],
] as const;
type TabKey = (typeof TABS)[number][0];

const inputClass =
  "w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black text-black transition";
const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5";
const smallBtn =
  "text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 cursor-pointer";
const miniBtn =
  "text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer disabled:opacity-30 disabled:cursor-default";
const cardClass = "rounded-2xl border border-neutral-200 p-4 sm:p-5 bg-white";

type Pair = { a: string; b: string };
interface UnitRow {
  type: string;
  bedrooms: string;
  area: string;
  price: string;
  ppsf: string;
  status: string;
  note: string;
  planRaw: string;
  planUrl: string;
  planFile: File | null;
}
interface Pick1 { raw: string; url: string; file: File | null; preview: string }
type GItem =
  | { kind: "keep"; raw: string; url: string; caption: string }
  | { kind: "url"; url: string; caption: string }
  | { kind: "file"; file: File; preview: string; caption: string };

const EMPTY_PICK: Pick1 = { raw: "", url: "", file: null, preview: "" };
const EMPTY_UNIT: UnitRow = { type: "Townhouse", bedrooms: "", area: "", price: "", ppsf: "", status: "", note: "", planRaw: "", planUrl: "", planFile: null };

const cleanNum = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const fmtNum = (v: string) => {
  if (!v) return "";
  const [i, d] = v.split(".");
  const int = i ? Number(i).toLocaleString("en-US") : "0";
  return d !== undefined ? `${int}.${d}` : int;
};
const filled = (...v: string[]) => v.filter((s) => s.trim()).length;

function unitError(u: UnitRow): string | null {
  if (u.price && !(Number(u.price) > 0)) return "Price must be a number greater than 0.";
  if (u.area && !(Number(u.area) > 0)) return "Area must be a number greater than 0.";
  if (u.ppsf && !(Number(u.ppsf) > 0)) return "Price per sq ft must be a number greater than 0.";
  if (u.planFile && u.planFile.size > 8 * 1024 * 1024) return "Floor plan is larger than 8 MB.";
  return null;
}

function formatPrice(p: AdminProperty) {
  const n = `${p.price_from ? "From " : ""}AED ${Number(p.price).toLocaleString("en-US")}`;
  return p.listing_type === "rent" && p.price_period ? `${n} / ${p.price_period}` : n;
}

/** Reusable repeater: add, remove, move up/down, duplicate, per-row validation message. */
function Repeater<T extends object>({
  rows, onChange, make, render, addLabel, max = 50, errorOf, canDuplicate, hideAdd,
}: {
  rows: T[];
  onChange: (r: T[]) => void;
  make: () => T;
  render: (row: T, patch: (p: Partial<T>) => void, i: number) => React.ReactNode;
  addLabel?: string;
  max?: number;
  errorOf?: (row: T) => string | null;
  canDuplicate?: boolean;
  hideAdd?: boolean;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <div className="space-y-3">
        {rows.map((row, i) => {
          const err = errorOf ? errorOf(row) : null;
          return (
            <div key={i} className={`rounded-xl border p-3 bg-neutral-50/60 ${err ? "border-red-300" : "border-neutral-200"}`}>
              <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">{render(row, (p) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r))), i)}</div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div className="flex gap-1.5">
                    <button type="button" className={miniBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className={miniBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  </div>
                  <div className="flex gap-1.5">
                    {canDuplicate && rows.length < max && (
                      <button type="button" className={miniBtn} onClick={() => onChange([...rows.slice(0, i + 1), { ...row }, ...rows.slice(i + 1)])}>Copy</button>
                    )}
                    <button type="button" className={`${miniBtn} text-red-600`} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>Remove</button>
                  </div>
                </div>
              </div>
              {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            </div>
          );
        })}
      </div>
      {!hideAdd && (
        <button type="button" disabled={rows.length >= max} onClick={() => onChange([...rows, make()])} className={`${smallBtn} mt-3 disabled:opacity-40`}>
          + {addLabel ?? "Add row"}
        </button>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl bg-neutral-100 px-4 py-3 mb-4">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-black" />
      <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">{label}</span>
      <span className="text-xs text-neutral-500">{on ? "(shown when it has content)" : "(hidden on the page)"}</span>
    </label>
  );
}

/** One image: upload a file or paste a link. */
function ImagePick({ label, hint, value, onChange }: { label: string; hint?: string; value: Pick1; onChange: (v: Pick1) => void }) {
  const [link, setLink] = useState("");
  const shown = value.preview || value.url;
  return (
    <div className={`${cardClass} md:col-span-2`}>
      <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">{label}</h3>
      {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
      <div className="flex flex-col sm:flex-row gap-4 mt-3 items-start">
        {shown && (
          <div className="relative w-40 aspect-[4/3] rounded-xl overflow-hidden bg-neutral-100 shrink-0">
            <img src={shown} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { if (value.preview) URL.revokeObjectURL(value.preview); onChange(EMPTY_PICK); }}
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
                if (value.preview) URL.revokeObjectURL(value.preview);
                onChange({ raw: "", url: "", file, preview: URL.createObjectURL(file) });
                e.target.value = "";
              }}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-black file:text-white file:px-4 file:py-2.5 file:text-xs file:font-bold file:uppercase file:cursor-pointer"
            />
          </div>
          <div>
            <label className={labelClass}>Or paste a link</label>
            <div className="flex gap-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://..." />
              <button
                type="button"
                onClick={() => {
                  if (!/^https?:\/\//i.test(link.trim())) return;
                  if (value.preview) URL.revokeObjectURL(value.preview);
                  onChange({ raw: link.trim(), url: link.trim(), file: null, preview: "" });
                  setLink("");
                }}
                className="bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase px-4 rounded-xl cursor-pointer"
              >Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const auth = useAuth() as unknown as { user: unknown; loading: boolean; token?: string | null };
  const { user, loading: authLoading } = auth;

  const [items, setItems] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ListingType>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("basics");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<"published" | "draft">("draft");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminProperty | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [gallery, setGallery] = useState<GItem[]>([]);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [hero, setHero] = useState<Pick1>(EMPTY_PICK);
  const [mp, setMp] = useState<Pick1>(EMPTY_PICK);
  const [story, setStory] = useState<Pick1>(EMPTY_PICK);
  const [seoImg, setSeoImg] = useState<Pick1>(EMPTY_PICK);

  const [mpRows, setMpRows] = useState<MpRow[]>([]);
  const [highlights, setHighlights] = useState<Pair[]>([]);
  const [storyParas, setStoryParas] = useState<string[]>(["", "", ""]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [amenitiesText, setAmenitiesText] = useState("");
  const [plans, setPlans] = useState<PayPlan[]>([]);
  const [faqs, setFaqs] = useState<Pair[]>([]);
  const [picks, setPicks] = useState<{ id: number; line: string }[]>([]);
  const [pickSearch, setPickSearch] = useState("");
  const [perks, setPerks] = useState<PerkRow[]>([]);
  const [sections, setSections] = useState<Record<string, boolean>>({});

  const [developers, setDevelopers] = useState<DirectoryRef[]>([]);
  const [communities, setCommunities] = useState<DirectoryRef[]>([]);

  const getToken = useCallback(() => auth.token ?? getStoredToken(), [auth.token]);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await adminRequest<{ data: AdminProperty[] }>("/admin/properties", { token: getToken() });
      setItems(res.data);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  useEffect(() => {
    fetchPublicList("/developers").then(setDevelopers);
    fetchPublicList("/communities").then(setCommunities);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (typeFilter !== "all" && p.listing_type !== typeFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
    });
  }, [items, search, typeFilter]);

  const secOn = (k: string) => sections[k] !== false;
  const setSec = (k: string, v: boolean) => setSections((s) => ({ ...s, [k]: v }));

  function revokeAll() {
    gallery.forEach((g) => g.kind === "file" && URL.revokeObjectURL(g.preview));
    [hero, mp, story, seoImg].forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
  }

  function closeModal() {
    revokeAll();
    setModalOpen(false);
  }

  function resetLists() {
    setGallery([]);
    setGalleryUrl("");
    setHero(EMPTY_PICK);
    setMp(EMPTY_PICK);
    setStory(EMPTY_PICK);
    setSeoImg(EMPTY_PICK);
    setMpRows([]);
    setHighlights([]);
    setStoryParas(["", "", ""]);
    setUnits([]);
    setStats([]);
    setAmenitiesText("");
    setPlans([]);
    setFaqs([]);
    setPicks([]);
    setPickSearch("");
    setPerks([]);
    setSections({});
  }

  function openAdd() {
    revokeAll();
    setEditingId(null);
    setEditingStatus("draft");
    setForm(EMPTY_FORM);
    resetLists();
    setTab("basics");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(p: AdminProperty) {
    revokeAll();
    resetLists();
    setEditingId(p.id);
    setEditingStatus(p.status);
    const extras = {} as Record<ExtraKey, string>;
    EXTRA_TEXT.forEach((k) => {
      extras[k] = (p[k] as string | null) ?? "";
    });
    setForm({
      title: p.title,
      listing_type: p.listing_type,
      property_type: p.property_type ?? "",
      location: p.location,
      developer: p.developer ?? "",
      developer_id: p.developer_id ? String(p.developer_id) : "",
      community_id: p.community_id ? String(p.community_id) : "",
      // when unit types exist the stored price is the auto "from" price; leave the manual field empty
      price: p.price_from ? "" : String(p.price ?? ""),
      price_period: p.price_period ?? "Year",
      bedrooms: p.unit_types?.length ? "" : p.bedrooms ?? "",
      bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
      area_sq_ft: p.area_sq_ft != null ? String(p.area_sq_ft) : "",
      tagline: p.tagline ?? "",
      handover_date: p.handover_date ?? "",
      description: p.description ?? "",
      phone: p.phone ?? "",
      whatsapp: p.whatsapp ?? "",
      is_featured: p.is_featured,
      status: p.status,
      related_mode: p.related_mode ?? "auto",
      ...extras,
    });
    setGallery(p.images_raw.map((raw, i) => ({ kind: "keep" as const, raw, url: p.images[i], caption: p.gallery_captions?.[i] ?? "" })));
    const pick = (raw: string | null, url: string | null): Pick1 => (raw && url ? { raw, url, file: null, preview: "" } : EMPTY_PICK);
    setHero(pick(p.files_raw?.hero_image ?? null, p.hero_image));
    setMp(pick(p.files_raw?.mp_image ?? null, p.mp_image));
    setStory(pick(p.files_raw?.story_image ?? null, p.story_image));
    setSeoImg(pick(p.files_raw?.seo_image ?? null, p.seo_image));
    setMpRows(p.mp_rows ?? []);
    setHighlights((p.highlights ?? []).map((h) => ({ a: h.title, b: h.description })));
    const paras = [...(p.story_paragraphs ?? [])];
    while (paras.length < 3) paras.push("");
    setStoryParas(paras.slice(0, 3));
    setUnits(
      (p.unit_types ?? []).map((u) => ({
        type: u.type,
        bedrooms: u.bedrooms,
        area: u.area_sq_ft != null ? String(u.area_sq_ft) : "",
        price: u.price != null ? String(u.price) : "",
        ppsf: u.price_per_sq_ft != null ? String(u.price_per_sq_ft) : "",
        status: u.status,
        note: u.note,
        planRaw: u.floor_plan_raw ?? "",
        planUrl: u.floor_plan ?? "",
        planFile: null,
      })),
    );
    setStats(p.stats ?? []);
    setAmenitiesText((p.amenities ?? []).join("\n"));
    setPlans(
      p.payment_plans?.length
        ? p.payment_plans
        : p.payment_plan
          ? [{ tab: "", ...p.payment_plan }]
          : [],
    );
    setFaqs((p.faqs ?? []).map((f) => ({ a: f.question, b: f.answer })));
    setPicks(p.related_picks ?? []);
    setPerks(p.enq_perks ?? []);
    setSections({ ...(p.sections ?? {}) });
    setTab("basics");
    setFormError("");
    setModalOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Text input / textarea bound to a string field. */
  function txt(key: StrKey, label: string, placeholder = "", area = false, wide = false) {
    return (
      <div className={area || wide ? "md:col-span-2" : ""}>
        <label className={labelClass}>{label}</label>
        {area ? (
          <textarea rows={3} value={form[key]} onChange={(e) => set(key, e.target.value as FormState[typeof key])} className={inputClass} placeholder={placeholder} />
        ) : (
          <input value={form[key]} onChange={(e) => set(key, e.target.value as FormState[typeof key])} className={inputClass} placeholder={placeholder} />
        )}
      </div>
    );
  }

  const otherListings = items.filter((x) => x.id !== editingId);
  const hasUnitPrice = units.some((u) => Number(u.price) > 0);

  const counts: Record<TabKey, number> = {
    basics: filled(form.tagline, form.description, form.developer, form.handover_date, form.bathrooms, form.area_sq_ft, form.bedrooms) + (form.community_id ? 1 : 0),
    hero: filled(form.hero_eyebrow, form.hero_title, form.hero_subtitle, form.hero_btn1_label, form.hero_btn2_label) + (hero.raw || hero.file ? 1 : 0),
    gallery: gallery.length + mpRows.length + (mp.raw || mp.file ? 1 : 0) + filled(form.mp_label, form.mp_heading, form.mp_intro),
    story: highlights.length + storyParas.filter((s) => s.trim()).length + filled(form.story_heading) + (story.raw || story.file ? 1 : 0),
    units: units.length,
    stats: stats.length,
    amenities: amenitiesText.split("\n").filter((l) => l.trim()).length,
    payment: plans.length,
    faqs: faqs.length,
    related: picks.length,
    enquiry: perks.length + filled(form.enq_heading, form.enq_intro, form.enq_email, form.enq_privacy),
    seo: filled(form.seo_title, form.seo_description) + (seoImg.raw || seoImg.file ? 1 : 0),
  };

  function addGalleryUrl() {
    const value = galleryUrl.trim();
    if (!/^https?:\/\//i.test(value)) {
      setFormError("Image link must start with http:// or https://");
      return;
    }
    setFormError("");
    setGallery((g) => [...g, { kind: "url", url: value, caption: "" }]);
    setGalleryUrl("");
  }

  function moveGallery(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= gallery.length) return;
    const next = [...gallery];
    [next[i], next[j]] = [next[j], next[i]];
    setGallery(next);
  }

  function removeGallery(i: number) {
    const g = gallery[i];
    if (g.kind === "file") URL.revokeObjectURL(g.preview);
    setGallery(gallery.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.title.trim() || !form.location.trim()) {
      setTab("basics");
      setFormError("Title and location are required.");
      return;
    }
    if (!hasUnitPrice && !Number(form.price)) {
      setTab("basics");
      setFormError("Enter a price, or add at least one unit type with a price.");
      return;
    }
    if (gallery.length === 0) {
      setTab("gallery");
      setFormError("Add at least one image to the gallery.");
      return;
    }
    const badUnit = units.findIndex((u) => unitError(u));
    if (badUnit >= 0) {
      setTab("units");
      setFormError(`Unit type row ${badUnit + 1}: ${unitError(units[badUnit])}`);
      return;
    }

    const body = new FormData();
    body.append("title", form.title);
    body.append("listing_type", form.listing_type);
    body.append("property_type", form.property_type);
    body.append("location", form.location);
    body.append("developer", form.developer);
    body.append("developer_id", form.developer_id);
    body.append("community_id", form.community_id);
    body.append("price", form.price);
    body.append("price_period", form.listing_type === "rent" ? form.price_period : "");
    body.append("bedrooms", form.bedrooms);
    body.append("bathrooms", form.bathrooms);
    body.append("area_sq_ft", form.area_sq_ft);
    body.append("tagline", form.tagline);
    body.append("handover_date", form.handover_date);
    body.append("description", form.description);
    body.append("phone", form.phone);
    body.append("whatsapp", form.whatsapp);
    body.append("is_featured", form.is_featured ? "1" : "0");
    body.append("status", form.status);
    body.append("related_mode", form.related_mode);
    EXTRA_TEXT.forEach((k) => body.append(k, form[k]));

    body.set("highlights", JSON.stringify(highlights.map((r) => ({ title: r.a, description: r.b }))));
    body.set("faqs", JSON.stringify(faqs.map((r) => ({ question: r.a, answer: r.b }))));
    body.set("amenities", JSON.stringify(amenitiesText.split("\n").map((l) => l.trim()).filter(Boolean)));
    body.set("stats", JSON.stringify(stats));
    body.set("mp_rows", JSON.stringify(mpRows));
    body.set("story_paragraphs", JSON.stringify(storyParas));
    body.set("payment_plans", JSON.stringify(plans));
    body.set("enq_perks", JSON.stringify(perks));
    body.set("related_picks", JSON.stringify(picks));
    body.set("sections", JSON.stringify(sections));
    body.set(
      "unit_types",
      JSON.stringify(
        units.map((u) => ({
          type: u.type,
          bedrooms: u.bedrooms,
          area_sq_ft: u.area,
          price: u.price,
          price_per_sq_ft: u.ppsf,
          status: u.status,
          note: u.note,
          floor_plan: u.planFile ? "" : u.planRaw,
        })),
      ),
    );
    units.forEach((u, i) => {
      if (u.planFile) body.append(`unit_floor_plans[${i}]`, u.planFile);
    });

    let fileIndex = 0;
    const galleryPayload = gallery.map((g) => {
      if (g.kind === "keep") return { kind: "keep", value: g.raw, caption: g.caption };
      if (g.kind === "url") return { kind: "url", value: g.url, caption: g.caption };
      body.append("images[]", g.file);
      return { kind: "file", index: fileIndex++, caption: g.caption };
    });
    body.set("gallery", JSON.stringify(galleryPayload));

    const singles: [string, Pick1][] = [["hero_image", hero], ["mp_image", mp], ["story_image", story], ["seo_image", seoImg]];
    singles.forEach(([key, pk]) => {
      body.set(key, pk.file ? "" : pk.raw);
      if (pk.file) body.set(`${key}_file`, pk.file);
    });

    setSaving(true);
    try {
      await adminRequest(editingId ? `/admin/properties/${editingId}` : "/admin/properties", {
        method: "POST",
        body,
        token: getToken(),
      });
      closeModal();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the property.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminRequest(`/admin/properties/${deleteTarget.id}`, { method: "DELETE", token: getToken() });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not delete the property.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const developerNames = developers.length ? developers.map((d) => d.name) : FALLBACK_DEVELOPERS;
  const pickResults = otherListings
    .filter((x) => !picks.some((p) => p.id === x.id))
    .filter((x) => !pickSearch.trim() || `${x.title} ${x.location}`.toLowerCase().includes(pickSearch.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">Properties</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Listings added here appear on the Home, Buy, Rent, Ready To Move In and Off-Plan pages.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition shadow-md cursor-pointer"
        >
          + Add Property
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm p-4 sm:p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Search title or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | ListingType)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="all">All listing types</option>
          {(Object.keys(LISTING_LABELS) as ListingType[]).map((t) => (
            <option key={t} value={t}>
              {LISTING_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {pageError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{pageError}</div>
      )}

      <div className="bg-white rounded-[24px] border border-neutral-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-500">Loading properties...</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">
            {items.length === 0 ? "No properties yet. Click “Add Property” to create the first one." : "No properties match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-4 font-bold">Property</th>
                  <th className="px-5 py-4 font-bold">Type</th>
                  <th className="px-5 py-4 font-bold">Price</th>
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
                          <div className="font-bold text-neutral-900 truncate max-w-[300px]">{p.title}</div>
                          <div className="text-xs text-neutral-500 truncate max-w-[300px]">📍 {p.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="bg-neutral-100 text-neutral-800 font-semibold text-xs px-3 py-1.5 rounded-lg">
                        {LISTING_LABELS[p.listing_type]}
                      </span>
                      {p.is_featured && (
                        <span className="ml-2 bg-black text-white font-semibold text-xs px-3 py-1.5 rounded-lg">Featured</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-bold text-neutral-900">{formatPrice(p)}</td>
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
                          href={`${SITE_URL}/properties/${p.id}`}
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
          <form onSubmit={save} className="bg-white rounded-[24px] shadow-2xl max-w-[1000px] mx-auto">
            <div className="flex items-start justify-between gap-4 p-6 sm:p-8 pb-4">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-neutral-900">{editingId ? "Edit Property" : "Add Property"}</h2>
                <p className="text-xs text-neutral-500 mt-1">Every block is optional. Empty blocks are hidden on the listing page.</p>
              </div>
              <div className="flex items-center gap-2">
                {editingId && editingStatus === "published" && (
                  <a href={`${SITE_URL}/properties/${editingId}`} target="_blank" rel="noopener noreferrer" className={smallBtn}>
                    Preview ↗
                  </a>
                )}
                <button type="button" onClick={closeModal} className="w-9 h-9 rounded-full border border-neutral-300 hover:border-black flex items-center justify-center cursor-pointer" aria-label="Close">
                  ✕
                </button>
              </div>
            </div>

            {/* TABS */}
            <div className="sticky top-0 z-10 bg-white border-y border-neutral-200 px-4 sm:px-8 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer whitespace-nowrap ${
                      tab === key ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                    }`}
                  >
                    {label}
                    <span className={`min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[10px] ${counts[key] > 0 ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}`}>
                      {counts[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              {/* ---------------- BASICS ---------------- */}
              {tab === "basics" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Title *</label>
                    <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} placeholder="Azizi Versilia" />
                  </div>

                  <div>
                    <label className={labelClass}>Listing type *</label>
                    <select value={form.listing_type} onChange={(e) => set("listing_type", e.target.value as ListingType)} className={`${inputClass} cursor-pointer`}>
                      {(Object.keys(LISTING_LABELS) as ListingType[]).map((t) => (
                        <option key={t} value={t}>{LISTING_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={form.status} onChange={(e) => set("status", e.target.value as "published" | "draft")} className={`${inputClass} cursor-pointer`}>
                      <option value="published">Published (visible on website)</option>
                      <option value="draft">Draft (hidden)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Property type</label>
                    <select value={form.property_type} onChange={(e) => set("property_type", e.target.value)} className={`${inputClass} cursor-pointer`}>
                      <option value="">—</option>
                      {PROPERTY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Location *</label>
                    <input value={form.location} onChange={(e) => set("location", e.target.value)} className={inputClass} placeholder="Um Fanain, Sharjah" />
                  </div>

                  <div>
                    <label className={labelClass}>Developer (pick from Developers list)</label>
                    <select
                      value={form.developer_id}
                      onChange={(e) => {
                        const d = developers.find((x) => String(x.id) === e.target.value);
                        setForm((f) => ({ ...f, developer_id: e.target.value, developer: d ? d.name : f.developer }));
                      }}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="">— match by name —</option>
                      {developers.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Developer name (text)</label>
                    <input list="developer-options" value={form.developer} onChange={(e) => set("developer", e.target.value)} className={inputClass} placeholder="Azizi" />
                    <datalist id="developer-options">
                      {developerNames.map((d) => (<option key={d} value={d} />))}
                    </datalist>
                  </div>

                  <div>
                    <label className={labelClass}>Community (optional)</label>
                    <select value={form.community_id} onChange={(e) => set("community_id", e.target.value)} className={`${inputClass} cursor-pointer`}>
                      <option value="">—</option>
                      {communities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer select-none pb-3">
                      <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="w-5 h-5 accent-black" />
                      <span className="text-sm font-semibold text-neutral-800">Featured (Exclusive Listing + Hot Properties)</span>
                    </label>
                  </div>

                  <div>
                    <label className={labelClass}>Price (AED){hasUnitPrice ? "" : " *"}</label>
                    <input
                      inputMode="decimal"
                      value={fmtNum(form.price)}
                      onChange={(e) => set("price", cleanNum(e.target.value))}
                      className={inputClass}
                      placeholder={hasUnitPrice ? "Auto: lowest unit price" : "3,000,000"}
                      disabled={hasUnitPrice}
                    />
                    {hasUnitPrice && <p className="text-[11px] text-neutral-500 mt-1">Cards and filters use the lowest unit price (“From AED …”).</p>}
                  </div>
                  {form.listing_type === "rent" ? (
                    <div>
                      <label className={labelClass}>Rent period</label>
                      <select value={form.price_period} onChange={(e) => set("price_period", e.target.value)} className={`${inputClass} cursor-pointer`}>
                        <option value="Year">Per year</option>
                        <option value="Month">Per month</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Handover date</label>
                      <input value={form.handover_date} onChange={(e) => set("handover_date", e.target.value)} className={inputClass} placeholder="31 July 2029" />
                    </div>
                  )}
                  {form.listing_type === "rent" && (
                    <div>
                      <label className={labelClass}>Handover date (optional)</label>
                      <input value={form.handover_date} onChange={(e) => set("handover_date", e.target.value)} className={inputClass} />
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Bedrooms</label>
                    <input value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} className={inputClass} placeholder={units.length ? "Auto: range from unit types" : "3  or  Studio  or  3, 4"} disabled={units.some((u) => u.bedrooms.trim() !== "")} />
                  </div>
                  <div>
                    <label className={labelClass}>Bathrooms</label>
                    <input type="number" min="0" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} className={inputClass} placeholder="4" />
                  </div>
                  <div>
                    <label className={labelClass}>Area (sq ft)</label>
                    <input type="number" min="0" value={form.area_sq_ft} onChange={(e) => set("area_sq_ft", e.target.value)} className={inputClass} placeholder="2560" />
                  </div>
                  <div>
                    <label className={labelClass}>Tagline / home card line</label>
                    <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputClass} placeholder="Open air and the western approach." />
                  </div>

                  <div>
                    <label className={labelClass}>Phone</label>
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp</label>
                    <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inputClass} />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Description</label>
                    <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} placeholder="Shown on the single listing page" />
                  </div>

                  <div className="md:col-span-2">
                    <Toggle label="Developer section" on={secOn("developer")} onChange={(v) => setSec("developer", v)} />
                  </div>
                </div>
              )}

              {/* ---------------- HERO ---------------- */}
              {tab === "hero" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {txt("hero_eyebrow", "Top line (eyebrow)", "NORTH-WEST CLUSTER — AZIZI FLORENCE, UM FANAIN", false, true)}
                  <p className="md:col-span-2 -mt-2 text-xs text-neutral-500">Default: “{form.property_type || "Property"} — {form.developer || "developer"}, {form.location || "location"}”.</p>
                  {txt("hero_title", "Main title", form.title || "Defaults to the listing title", false, true)}
                  {txt("hero_subtitle", "Subtitle paragraph", "Defaults to the tagline", true)}
                  <ImagePick label="Hero background image" hint="Default: the first gallery image." value={hero} onChange={setHero} />
                  {txt("hero_btn1_label", "Button 1 label", "PRICES & AVAILABILITY")}
                  {txt("hero_btn1_target", "Button 1 target", "#prices")}
                  {txt("hero_btn2_label", "Button 2 label", "SEE THE PHOTOS")}
                  {txt("hero_btn2_target", "Button 2 target", "#masterplan")}
                  <p className="md:col-span-2 text-xs text-neutral-500">Targets can be #anchors (#prices, #masterplan, #request-floor-plans), /paths or full https:// links.</p>
                </div>
              )}

              {/* ---------------- GALLERY & MASTER PLAN ---------------- */}
              {tab === "gallery" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Toggle label="“Where it sits” block (master plan + gallery)" on={secOn("masterplan")} onChange={(v) => setSec("masterplan", v)} />
                    <Toggle label="Gallery photos inside this block" on={secOn("gallery")} onChange={(v) => setSec("gallery", v)} />
                  </div>

                  <div className={cardClass}>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Gallery *</h3>
                    <p className="text-xs text-neutral-500 mt-1 mb-4">The first image is the main photo. Use the arrows to reorder. Captions are optional.</p>
                    {gallery.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {gallery.map((g, i) => {
                          const src = g.kind === "file" ? g.preview : g.url;
                          return (
                            <div key={`${src}-${i}`} className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
                              <div className="relative aspect-[4/3] bg-neutral-100">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                {i === 0 && <span className="absolute top-1.5 left-1.5 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-md">MAIN</span>}
                                <button type="button" onClick={() => removeGallery(i)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 text-white text-xs cursor-pointer" aria-label="Remove image">✕</button>
                              </div>
                              <div className="p-2 space-y-2">
                                <input value={g.caption} onChange={(e) => setGallery((l) => l.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))} className={`${inputClass} !py-2 !text-xs`} placeholder="Caption (optional)" />
                                <div className="flex gap-1.5">
                                  <button type="button" className={miniBtn} disabled={i === 0} onClick={() => moveGallery(i, -1)}>← Earlier</button>
                                  <button type="button" className={miniBtn} disabled={i === gallery.length - 1} onClick={() => moveGallery(i, 1)}>Later →</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Upload photos (max 4 MB each)</label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const chosen = Array.from(e.target.files ?? []);
                            setGallery((g) => [...g, ...chosen.map((file) => ({ kind: "file" as const, file, preview: URL.createObjectURL(file), caption: "" }))]);
                            e.target.value = "";
                          }}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-black file:text-white file:px-4 file:py-2.5 file:text-xs file:font-bold file:uppercase file:cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Or paste an image link</label>
                        <div className="flex gap-2">
                          <input value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGalleryUrl(); } }} className={inputClass} placeholder="https://..." />
                          <button type="button" onClick={addGalleryUrl} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase px-4 rounded-xl cursor-pointer">Add</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                    <h3 className="md:col-span-2 text-sm font-extrabold uppercase tracking-wider text-neutral-800">“Where it sits” texts</h3>
                    {txt("mp_label", "Small label", "WHERE IT SITS")}
                    {txt("breadcrumb", "Breadcrumb text", form.title || "Defaults to the title")}
                    {txt("mp_heading", "Heading", form.title ? `${form.title} at a glance` : "", false, true)}
                    {txt("mp_intro", "Intro paragraph", "", true)}
                    <ImagePick label="Large image (master plan, map or any photo)" hint="Shown first in the photo viewer. Leave empty to show the gallery only." value={mp} onChange={setMp} />
                    {txt("mp_caption", "Image caption", "MASTER PLAN — CLUSTER FOOTPRINTS INDICATIVE", false, true)}
                  </div>

                  <div className={cardClass}>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Right-hand list</h3>
                    <p className="text-xs text-neutral-500 mt-1 mb-3">Leave the rows empty to show the automatic “Key details” list (type, bedrooms, bathrooms, area, developer, handover).</p>
                    <div className="mb-3">{txt("mp_list_title", "List title", "The six clusters")}</div>
                    <Repeater<MpRow>
                      rows={mpRows}
                      onChange={setMpRows}
                      make={() => ({ name: "", label: "", here: false, link: "" })}
                      addLabel="Add list row"
                      max={20}
                      errorOf={(r) => (!r.name.trim() && (r.label || r.link) ? "Enter a name or this row is dropped." : null)}
                      render={(r, patch) => (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={r.name} onChange={(e) => patch({ name: e.target.value })} className={inputClass} placeholder="Name (Azizi Lucardo)" />
                          <input value={r.label} onChange={(e) => patch({ label: e.target.value })} className={inputClass} placeholder="Label (NORTH-EAST)" />
                          <select value={r.link} onChange={(e) => patch({ link: e.target.value })} className={`${inputClass} cursor-pointer`}>
                            <option value="">— no link —</option>
                            {otherListings.map((x) => (<option key={x.id} value={String(x.id)}>{x.title}</option>))}
                          </select>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={r.here} onChange={(e) => patch({ here: e.target.checked })} className="w-4 h-4 accent-black" />
                            “You are here”
                          </label>
                        </div>
                      )}
                    />
                    <div className="mt-3">{txt("mp_footnote", "Footnote under the list", "", true)}</div>
                  </div>
                </div>
              )}

              {/* ---------------- HIGHLIGHTS & STORY ---------------- */}
              {tab === "story" && (
                <div className="space-y-5">
                  <div className={cardClass}>
                    <Toggle label="“What the plan shows” rows" on={secOn("offers")} onChange={(v) => setSec("offers", v)} />
                    <p className="text-xs text-neutral-500 mb-3">Leave empty to build the rows from the description instead.</p>
                    <div className="mb-3">{txt("offers_heading", "Section heading", form.title ? `What ${form.title} offers` : "")}</div>
                    <Repeater<Pair>
                      rows={highlights}
                      onChange={setHighlights}
                      make={() => ({ a: "", b: "" })}
                      addLabel="Add row"
                      max={30}
                      errorOf={(r) => (!r.a.trim() && r.b.trim() ? "Add a title or this row is dropped." : null)}
                      render={(r, patch) => (
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
                          <input value={r.a} onChange={(e) => patch({ a: e.target.value })} className={inputClass} placeholder="Title" />
                          <textarea rows={2} value={r.b} onChange={(e) => patch({ b: e.target.value })} className={inputClass} placeholder="Description" />
                        </div>
                      )}
                    />
                    <div className="mt-3">{txt("offers_footnote", "Footnote under the rows", "", true)}</div>
                  </div>

                  <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                    <div className="md:col-span-2">
                      <Toggle label="Story section (dark, image left / text right)" on={secOn("story")} onChange={(v) => setSec("story", v)} />
                    </div>
                    {txt("story_label", "Small label", "THE NAME")}
                    {txt("story_heading", "Heading", "Not a town — a coastline")}
                    {storyParas.map((s, i) => (
                      <div key={i} className="md:col-span-2">
                        <label className={labelClass}>Paragraph {i + 1}</label>
                        <textarea rows={3} value={s} onChange={(e) => setStoryParas((l) => l.map((x, idx) => (idx === i ? e.target.value : x)))} className={inputClass} />
                      </div>
                    ))}
                    <ImagePick label="Story image" value={story} onChange={setStory} />
                    {txt("story_caption", "Image caption", "", false, true)}
                    {txt("story_btn_label", "Button label (optional)")}
                    {txt("story_btn_link", "Button link", "#request-floor-plans")}
                  </div>
                </div>
              )}

              {/* ---------------- UNIT TYPES & PRICES ---------------- */}
              {tab === "units" && (
                <div className="space-y-5">
                  <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                    <div className="md:col-span-2">
                      <Toggle label="“The residences” prices table" on={secOn("residences")} onChange={(v) => setSec("residences", v)} />
                    </div>
                    {txt("res_label", "Small label", "THE RESIDENCES")}
                    {txt("res_heading", "Heading", "Home types released at …")}
                    {txt("res_intro", "Intro paragraph", "", true)}
                    {txt("res_btn_label", "Button label", "REQUEST DETAILS FOR THIS PROPERTY")}
                    {txt("res_btn_target", "Button target", "#request-floor-plans")}
                  </div>

                  <div className={cardClass}>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-800">Unit types</h3>
                    <p className="text-xs text-neutral-500 mt-1 mb-4">
                      One row per home type. The listing’s headline price becomes the lowest unit price (“From AED …”) and the bedrooms on cards become a range. Price per sq ft is calculated unless you override it.
                    </p>
                    <Repeater<UnitRow>
                      rows={units}
                      onChange={setUnits}
                      make={() => ({ ...EMPTY_UNIT })}
                      addLabel="Add unit type"
                      max={40}
                      canDuplicate
                      errorOf={unitError}
                      render={(u, patch) => {
                        const auto = Number(u.price) > 0 && Number(u.area) > 0 ? Math.round((Number(u.price) / Number(u.area)) * 100) / 100 : null;
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                              <div>
                                <label className={labelClass}>Type</label>
                                <input list="unit-type-options" value={u.type} onChange={(e) => patch({ type: e.target.value })} className={inputClass} placeholder="Townhouse" />
                              </div>
                              <div>
                                <label className={labelClass}>Bedrooms</label>
                                <input value={u.bedrooms} onChange={(e) => patch({ bedrooms: e.target.value })} className={inputClass} placeholder="3 Bedroom" />
                              </div>
                              <div>
                                <label className={labelClass}>Start area (sq ft)</label>
                                <input inputMode="decimal" value={fmtNum(u.area)} onChange={(e) => patch({ area: cleanNum(e.target.value) })} className={inputClass} placeholder="2,223.84" />
                              </div>
                              <div>
                                <label className={labelClass}>Start price (AED)</label>
                                <input inputMode="decimal" value={fmtNum(u.price)} onChange={(e) => patch({ price: cleanNum(e.target.value) })} className={inputClass} placeholder="1,890,000" />
                              </div>
                              <div>
                                <label className={labelClass}>Price / sq ft</label>
                                <input inputMode="decimal" value={fmtNum(u.ppsf)} onChange={(e) => patch({ ppsf: cleanNum(e.target.value) })} className={inputClass} placeholder={auto ? `Auto: ${auto.toLocaleString("en-US")}` : "Auto"} />
                              </div>
                              <div>
                                <label className={labelClass}>Availability</label>
                                <select value={u.status} onChange={(e) => patch({ status: e.target.value })} className={`${inputClass} cursor-pointer`}>
                                  {STATUSES.map((s) => (<option key={s} value={s}>{s || "—"}</option>))}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input value={u.note} onChange={(e) => patch({ note: e.target.value })} className={inputClass} placeholder="Short note (optional)" />
                              <div className="flex items-center gap-2 text-xs">
                                {(u.planFile || u.planUrl) && (
                                  <>
                                    <span className="text-neutral-600 truncate max-w-[180px]">{u.planFile ? u.planFile.name : "Floor plan saved"}</span>
                                    <button type="button" className={`${miniBtn} text-red-600`} onClick={() => patch({ planFile: null, planRaw: "", planUrl: "" })}>Remove plan</button>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) patch({ planFile: f });
                                    e.target.value = "";
                                  }}
                                  className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-black file:text-white file:px-3 file:py-2 file:text-[11px] file:font-bold file:uppercase file:cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <datalist id="unit-type-options">
                      {UNIT_TYPES.map((t) => (<option key={t} value={t} />))}
                    </datalist>
                    <p className="text-[11px] text-neutral-500 mt-3">Floor plans: image or PDF, up to 8 MB.</p>
                  </div>
                </div>
              )}

              {/* ---------------- STATS ---------------- */}
              {tab === "stats" && (
                <div className={cardClass}>
                  <Toggle label="Stats grid" on={secOn("stats")} onChange={(v) => setSec("stats", v)} />
                  <p className="text-xs text-neutral-500 mb-4">Big numbers, for example 10,702 / HOMES IN THE MASTER PLAN. Leave empty to show the automatic stats (bedrooms, bathrooms, sq ft, handover).</p>
                  <Repeater<StatRow>
                    rows={stats}
                    onChange={setStats}
                    make={() => ({ value: "", label: "" })}
                    addLabel="Add stat"
                    max={12}
                    errorOf={(r) => (!r.value.trim() && r.label.trim() ? "Add a value or this row is dropped." : null)}
                    render={(r, patch) => (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
                        <input value={r.value} onChange={(e) => patch({ value: e.target.value })} className={inputClass} placeholder="10,702" />
                        <input value={r.label} onChange={(e) => patch({ label: e.target.value })} className={inputClass} placeholder="HOMES IN THE MASTER PLAN" />
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ---------------- AMENITIES ---------------- */}
              {tab === "amenities" && (
                <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                  <div className="md:col-span-2">
                    <Toggle label="Amenities dark section" on={secOn("amenities")} onChange={(v) => setSec("amenities", v)} />
                  </div>
                  {txt("amenities_label", "Small label", "SHARED ACROSS THE SIX CLUSTERS")}
                  {txt("amenities_heading", "Heading", form.title ? `Everything ${form.title} comes with.` : "")}
                  {txt("amenities_intro", "Paragraph", "", true)}
                  <div className="md:col-span-2">
                    <label className={labelClass}>Amenity list (one per line)</label>
                    <textarea rows={7} value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} className={inputClass} placeholder={"Swimming pool\nGym\nChildren's play area"} />
                    <p className="text-[11px] text-neutral-500 mt-1">Leave empty to hide the whole section.</p>
                  </div>
                  {txt("amenities_btn_label", "Button label", "SEE THE FULL AMENITY LIST")}
                  {txt("amenities_btn_link", "Button link", "https://...")}
                </div>
              )}

              {/* ---------------- PAYMENT PLANS ---------------- */}
              {tab === "payment" && (
                <div className={cardClass}>
                  <Toggle label="Payment & handover" on={secOn("payment")} onChange={(v) => setSec("payment", v)} />
                  <div className="mb-4">{txt("pay_label", "Small label", "PAYMENT & HANDOVER")}</div>
                  <p className="text-xs text-neutral-500 mb-3">Add several plans (for example 30/70 and 60/40). With more than one plan the page shows tabs. Plans without steps are dropped.</p>
                  <Repeater<PayPlan>
                    rows={plans}
                    onChange={setPlans}
                    make={() => ({ tab: "", heading: "", intro: "", note: "", steps: [] })}
                    addLabel="Add payment plan"
                    max={6}
                    canDuplicate
                    errorOf={(pl) => (pl.steps.length === 0 ? "Add at least one step or this plan is dropped." : null)}
                    render={(pl, patch) => (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input value={pl.tab} onChange={(e) => patch({ tab: e.target.value })} className={inputClass} placeholder="Tab name (30/70 plan)" />
                          <input value={pl.heading} onChange={(e) => patch({ heading: e.target.value })} className={inputClass} placeholder="Heading (30/70, running to July 2029)" />
                        </div>
                        <textarea rows={2} value={pl.intro} onChange={(e) => patch({ intro: e.target.value })} className={inputClass} placeholder="Intro paragraph" />
                        <Repeater<{ label: string; percent: string; desc: string }>
                          rows={pl.steps}
                          onChange={(steps) => patch({ steps })}
                          make={() => ({ label: "", percent: "", desc: "" })}
                          addLabel="Add step"
                          max={12}
                          errorOf={(s) => (!s.label.trim() && !s.percent.trim() && s.desc.trim() ? "Add a label or percent." : null)}
                          render={(s, sp) => (
                            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.6fr_2fr] gap-2">
                              <input value={s.label} onChange={(e) => sp({ label: e.target.value })} className={inputClass} placeholder="1ST INSTALMENT" />
                              <input value={s.percent} onChange={(e) => sp({ percent: e.target.value })} className={inputClass} placeholder="10%" />
                              <input value={s.desc} onChange={(e) => sp({ desc: e.target.value })} className={inputClass} placeholder="Immediate — on booking and signature of the SPA" />
                            </div>
                          )}
                        />
                        <textarea rows={2} value={pl.note} onChange={(e) => patch({ note: e.target.value })} className={inputClass} placeholder="Footnote under the plan (optional)" />
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ---------------- FAQS ---------------- */}
              {tab === "faqs" && (
                <div className={cardClass}>
                  <Toggle label="FAQ section" on={secOn("faq")} onChange={(v) => setSec("faq", v)} />
                  <p className="text-xs text-neutral-500 mb-4">The first question opens by default. Leave empty to use automatic questions built from the listing details.</p>
                  <Repeater<Pair>
                    rows={faqs}
                    onChange={setFaqs}
                    make={() => ({ a: "", b: "" })}
                    addLabel="Add question"
                    max={50}
                    errorOf={(r) => (!r.a.trim() && r.b.trim() ? "Add the question or this row is dropped." : r.a.trim() && !r.b.trim() ? "Add an answer." : null)}
                    render={(r, patch) => (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
                        <input value={r.a} onChange={(e) => patch({ a: e.target.value })} className={inputClass} placeholder="Question" />
                        <textarea rows={2} value={r.b} onChange={(e) => patch({ b: e.target.value })} className={inputClass} placeholder="Answer" />
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ---------------- RELATED ---------------- */}
              {tab === "related" && (
                <div className={`${cardClass} space-y-4`}>
                  <Toggle label="“Continue browsing” cards" on={secOn("related")} onChange={(v) => setSec("related", v)} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {txt("related_label", "Small label", "THE OTHER FIVE")}
                    {txt("related_heading", "Heading", "Continue through the master plan")}
                  </div>
                  <div>
                    <label className={labelClass}>Mode</label>
                    <select value={form.related_mode} onChange={(e) => set("related_mode", e.target.value as "auto" | "manual")} className={`${inputClass} cursor-pointer`}>
                      <option value="auto">Automatic (same developer, then same listing type)</option>
                      <option value="manual">Manual (I pick the listings)</option>
                    </select>
                  </div>
                  {form.related_mode === "manual" && (
                    <>
                      <div>
                        <label className={labelClass}>Search listings to add</label>
                        <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} className={inputClass} placeholder="Type a title or location..." />
                        <div className="mt-2 rounded-xl border border-neutral-200 divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                          {pickResults.length === 0 && <div className="p-3 text-xs text-neutral-500">No listings found.</div>}
                          {pickResults.map((x) => (
                            <button key={x.id} type="button" onClick={() => setPicks((l) => (l.length >= 12 ? l : [...l, { id: x.id, line: "" }]))} className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 cursor-pointer flex justify-between gap-3">
                              <span className="font-semibold truncate">{x.title}</span>
                              <span className="text-xs text-neutral-500 truncate">{x.location}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <Repeater<{ id: number; line: string }>
                        rows={picks}
                        onChange={setPicks}
                        make={() => ({ id: 0, line: "" })}
                        hideAdd
                        max={12}
                        render={(r, patch) => (
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr] gap-2 items-center">
                            <div className="text-sm font-semibold truncate">{items.find((x) => x.id === r.id)?.title ?? `Listing #${r.id}`}</div>
                            <input value={r.line} onChange={(e) => patch({ line: e.target.value })} className={inputClass} placeholder="Short line (The arrival cluster.)" />
                          </div>
                        )}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ---------------- ENQUIRY ---------------- */}
              {tab === "enquiry" && (
                <div className={`${cardClass} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                  <div className="md:col-span-2">
                    <Toggle label="Register your interest section" on={secOn("enquiry")} onChange={(v) => setSec("enquiry", v)} />
                  </div>
                  {txt("enq_label", "Small label", "REGISTER YOUR INTEREST")}
                  {txt("enq_heading", "Heading", form.title ? `Ask for what is available at ${form.title}.` : "")}
                  {txt("enq_intro", "Intro paragraph", "", true)}
                  <div className="md:col-span-2">
                    <label className={labelClass}>“You will receive” perks</label>
                    <Repeater<PerkRow>
                      rows={perks}
                      onChange={setPerks}
                      make={() => ({ icon: "📄", text: "" })}
                      addLabel="Add perk"
                      max={8}
                      errorOf={(r) => (!r.text.trim() && r.icon.trim() ? "Add the perk text or this row is dropped." : null)}
                      render={(r, patch) => (
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <input value={r.icon} onChange={(e) => patch({ icon: e.target.value })} className={inputClass} placeholder="📄" />
                          <input value={r.text} onChange={(e) => patch({ text: e.target.value })} className={inputClass} placeholder="Current price list & availability" />
                        </div>
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp</label>
                    <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inputClass} />
                  </div>
                  {txt("enq_email", "Notification email (optional)", "sales@example.com")}
                  {txt("enq_privacy", "Privacy note", "Your details are handled confidentially and never sold to third parties.")}
                  <p className="md:col-span-2 text-xs text-neutral-500">The “Property interest” dropdown is built automatically from the unit types. Without unit types it shows this listing.</p>
                </div>
              )}

              {/* ---------------- SEO ---------------- */}
              {tab === "seo" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {txt("seo_title", "Page title", form.title || "Defaults to the listing title", false, true)}
                  {txt("seo_description", "Meta description", "Defaults to the tagline / description", true)}
                  <ImagePick label="Share image" hint="Default: the first gallery image." value={seoImg} onChange={setSeoImg} />
                </div>
              )}
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Property"}
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
            <h3 className="text-lg font-extrabold text-neutral-900">Delete this property?</h3>
            <p className="text-sm text-neutral-600 mt-2">
              “{deleteTarget.title}” will be removed from the website, along with its uploaded images and floor plans. This cannot be undone.
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