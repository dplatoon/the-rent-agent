import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RentcastListing = Database["public"]["Tables"]["rentcast_listings"]["Row"];

export type RentcastFilters = {
  state?: string;
  agent_id?: string;
  limit?: number;
};

export async function fetchRentcastListings(f: RentcastFilters = {}) {
  let q = supabase
    .from("rentcast_listings")
    .select("*")
    .eq("status", "active")
    .order("last_seen_at", { ascending: false });
  if (f.state) q = q.eq("state", f.state.toUpperCase());
  if (f.agent_id) q = q.eq("agent_id", f.agent_id.toUpperCase());
  if (f.limit) q = q.limit(f.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
