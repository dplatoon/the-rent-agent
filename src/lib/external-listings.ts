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

export type SharedFetchResult =
  | { status: "ok"; listing: ExternalListing }
  | { status: "expired"; expiredAt: string }
  | { status: "missing" };

export async function fetchSharedImport(token: string): Promise<SharedFetchResult> {
  const { data } = await supabase
    .from("external_listings")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (!data) return { status: "missing" };
  const listing = data as ExternalListing;
  if (listing.share_expires_at && new Date(listing.share_expires_at).getTime() < Date.now()) {
    return { status: "expired", expiredAt: listing.share_expires_at };
  }
  return { status: "ok", listing };
}

export function maskSensitive(l: ExternalListing): ExternalListing {
  if (!l.share_mask_sensitive) return l;
  // Drop notes; reduce location to last comma-segment (city/region only)
  const loc = l.location?.split(",").map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? null;
  return { ...l, notes: null, location: loc };
}
