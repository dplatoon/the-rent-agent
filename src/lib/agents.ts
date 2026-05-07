import { supabase } from "@/integrations/supabase/client";

export async function fetchAgents() {
  const { data, error } = await supabase.from("agents").select("*").order("state");
  if (error) throw error;
  return data;
}

export async function fetchAgent(id: string) {
  const { data, error } = await supabase.from("agents").select("*").eq("id", id.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Build the route params for linking to an agent's state page.
 * The /agent/$state route is keyed by the agent id (e.g. "AZ", "CA"),
 * lowercased to match the canonical URL form used across the app.
 */
export function agentRouteParams(agent: { id: string }): { state: string } {
  return { state: agent.id.toLowerCase() };
}

