import { supabase } from "@/integrations/supabase/client";

export type ExternalSource =
  | "zillow"
  | "apartments"
  | "rent"
  | "craigslist"
  | "facebook"
  | "trulia"
  | "hotpads"
  | "redfin"
  | "realtor"
  | "other";

export const SOURCE_META: Record<ExternalSource, { label: string; color: string }> = {
  zillow: { label: "Zillow", color: "#006AFF" },
  apartments: { label: "Apartments.com", color: "#00A1E0" },
  rent: { label: "Rent.com", color: "#FF6B35" },
  craigslist: { label: "Craigslist", color: "#7E1FFF" },
  facebook: { label: "FB Marketplace", color: "#1877F2" },
  trulia: { label: "Trulia", color: "#5EAA22" },
  hotpads: { label: "HotPads", color: "#FF5A5F" },
  redfin: { label: "Redfin", color: "#A02021" },
  realtor: { label: "Realtor.com", color: "#D92228" },
  other: { label: "Other", color: "#888" },
};

export function detectSource(url: string): ExternalSource {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (h.includes("zillow")) return "zillow";
    if (h.includes("apartments.com")) return "apartments";
    if (h.includes("rent.com")) return "rent";
    if (h.includes("craigslist")) return "craigslist";
    if (h.includes("facebook") || h.includes("fb.com")) return "facebook";
    if (h.includes("trulia")) return "trulia";
    if (h.includes("hotpads")) return "hotpads";
    if (h.includes("redfin")) return "redfin";
    if (h.includes("realtor")) return "realtor";
    return "other";
  } catch {
    return "other";
  }
}

export type ExternalListing = {
  id: string;
  user_id: string;
  url: string;
  source: ExternalSource;
  title: string | null;
  price_monthly: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location: string | null;
  notes: string | null;
  share_token: string;
  share_expires_at: string | null;
  share_mask_sensitive: boolean;
  created_at: string;
};

export async function listImports(): Promise<ExternalListing[]> {
  const { data, error } = await supabase
    .from("external_listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExternalListing[];
}

export type SharedListing = {
  id: string;
  source: ExternalSource;
  title: string | null;
  price_monthly: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location: string | null;
  notes: string | null;
  url: string | null;
  share_expires_at: string | null;
  share_mask_sensitive: boolean;
  created_at: string | null;
};

export type SharedFetchResult =
  | { status: "ok"; listing: SharedListing }
  | { status: "expired"; expiredAt: string }
  | { status: "missing" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchSharedImport(token: string): Promise<SharedFetchResult> {
  if (!UUID_RE.test(token)) return { status: "missing" };
  const { data, error } = await supabase.rpc("get_shared_listing", { _token: token });
  if (error || !data || data.length === 0) return { status: "missing" };
  const row = data[0] as any;
  if (row.expired) return { status: "expired", expiredAt: row.share_expires_at };
  return {
    status: "ok",
    listing: {
      id: row.id,
      source: row.source as ExternalSource,
      title: row.title,
      price_monthly: row.price_monthly,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      location: row.location,
      notes: row.notes,
      url: row.url,
      share_expires_at: row.share_expires_at,
      share_mask_sensitive: row.share_mask_sensitive,
      created_at: row.created_at,
    },
  };
}

export function isSafeHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type ShareExpiry = "never" | "1h" | "24h" | "7d" | "30d";

const EXPIRY_MS: Record<Exclude<ShareExpiry, "never">, number> = {
  "1h": 3600e3,
  "24h": 24 * 3600e3,
  "7d": 7 * 24 * 3600e3,
  "30d": 30 * 24 * 3600e3,
};

export function expiryToDate(v: string, now: number = Date.now()): string | null {
  if (v === "never") return null;
  const ms = EXPIRY_MS[v as Exclude<ShareExpiry, "never">];
  if (!ms) return null;
  return new Date(now + ms).toISOString();
}

