// Small helper for the admin Properties page. Separate from your existing api helper
// because listings are sent as multipart form data (image upload).

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
/** Public website, used by the Preview button. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type ListingType = "buy" | "rent" | "ready" | "offplan";

export interface UnitType {
  type: string;
  bedrooms: string;
  area_sq_ft: number | null;
  price: number | null;
  price_per_sq_ft: number | null;
  status: string;
  note: string;
  floor_plan: string | null; // resolved URL
  floor_plan_raw?: string | null; // stored value
}
export interface MpRow { name: string; label: string; here: boolean; link: string }
export interface StatRow { value: string; label: string }
export interface PayStep { label: string; percent: string; desc: string }
export interface PayPlan { tab: string; heading: string; intro: string; note: string; steps: PayStep[] }
export interface PerkRow { icon: string; text: string }
export interface RelatedPick { id: number; line: string }
export interface DirectoryRef { id: number; name: string }

export interface AdminProperty {
  id: number;
  title: string;
  listing_type: ListingType;
  property_type: string | null;
  location: string;
  developer: string | null;
  developer_id: number | null;
  community_id: number | null;
  price: number;
  price_from: boolean;
  price_period: string | null;
  bedrooms: string | null;
  bathrooms: number | null;
  area_sq_ft: number | null;
  tagline: string | null;
  handover_date: string | null;
  highlights: { title: string; description: string }[];
  amenities: string[];
  payment_plan: { heading: string; intro: string; note: string; steps: PayStep[] } | null;
  faqs: { question: string; answer: string }[];
  description: string | null;
  images: string[]; // full URLs for display
  images_raw: string[]; // stored values, sent back as keep
  image: string | null;
  phone: string;
  whatsapp: string;
  is_featured: boolean;
  status: "published" | "draft";

  unit_types: UnitType[];
  gallery_captions: string[];

  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  hero_btn1_label: string | null;
  hero_btn1_target: string | null;
  hero_btn2_label: string | null;
  hero_btn2_target: string | null;

  mp_label: string | null;
  mp_heading: string | null;
  mp_intro: string | null;
  mp_image: string | null;
  mp_caption: string | null;
  mp_list_title: string | null;
  mp_rows: MpRow[];
  mp_footnote: string | null;
  breadcrumb: string | null;

  offers_heading: string | null;
  offers_footnote: string | null;

  story_label: string | null;
  story_heading: string | null;
  story_paragraphs: string[];
  story_image: string | null;
  story_caption: string | null;
  story_btn_label: string | null;
  story_btn_link: string | null;

  res_label: string | null;
  res_heading: string | null;
  res_intro: string | null;
  res_btn_label: string | null;
  res_btn_target: string | null;
  stats: StatRow[];

  amenities_label: string | null;
  amenities_heading: string | null;
  amenities_intro: string | null;
  amenities_btn_label: string | null;
  amenities_btn_link: string | null;

  pay_label: string | null;
  payment_plans: PayPlan[];

  related_label: string | null;
  related_heading: string | null;
  related_mode: "auto" | "manual";
  related_picks: RelatedPick[];

  enq_label: string | null;
  enq_heading: string | null;
  enq_intro: string | null;
  enq_perks: PerkRow[];
  enq_email: string | null;
  enq_privacy: string | null;

  sections: Record<string, boolean>;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;

  files_raw: { hero_image: string | null; mp_image: string | null; story_image: string | null; seo_image: string | null };
}

/**
 * Fallback token lookup. The page first uses `token` from useAuth() if your AuthContext
 * exposes it. If your login saves the token under a different name, add that name here.
 */
export function getStoredToken(): string | null {
  try {
    for (const key of ["token", "auth_token", "vgt_token", "access_token", "admin_token"]) {
      const value = window.localStorage.getItem(key);
      if (value) return value.replace(/^"|"$/g, "");
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

export async function adminRequest<T = any>(
  path: string,
  options: { method?: string; body?: FormData; token: string | null },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const firstError = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
    const error = new Error(firstError ?? data?.message ?? "Something went wrong. Please try again.");
    (error as any).status = res.status;
    throw error;
  }

  return data as T;
}

/** Public list endpoints (/developers, /communities) -> [{id, name}] for the pickers. */
export async function fetchPublicList(path: string): Promise<DirectoryRef[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return ((json.data ?? []) as { id: number; name: string }[]).map((x) => ({ id: x.id, name: x.name }));
  } catch {
    return [];
  }
}