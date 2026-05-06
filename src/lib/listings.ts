import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];

export type ListingFilters = {
  state?: string;
  agent_id?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  petFriendly?: boolean;
  furnished?: boolean;
  featured?: boolean;
  limit?: number;
};

export async function fetchListings(f: ListingFilters = {}) {
  let q = supabase.from("listings").select("*").order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  if (f.state) q = q.eq("state", f.state.toUpperCase());
  if (f.agent_id) q = q.eq("agent_id", f.agent_id.toUpperCase());
  if (f.minPrice) q = q.gte("price_monthly", f.minPrice);
  if (f.maxPrice) q = q.lte("price_monthly", f.maxPrice);
  if (f.bedrooms != null) q = q.gte("bedrooms", f.bedrooms);
  if (f.petFriendly) q = q.eq("pet_friendly", true);
  if (f.furnished) q = q.eq("furnished", true);
  if (f.featured) q = q.eq("is_featured", true);
  if (f.limit) q = q.limit(f.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSavedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.listing_id));
}

export async function toggleSaved(userId: string, listingId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    await supabase.from("saved_listings").delete().eq("user_id", userId).eq("listing_id", listingId);
  } else {
    await supabase.from("saved_listings").insert({ user_id: userId, listing_id: listingId });
  }
}

export function formatPrice(n: number) {
  return `$${n.toLocaleString()}/mo`;
}
