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
