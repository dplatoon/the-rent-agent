import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const DEFAULT_ALLOWED = [
  "https://the-rent-agent.lovable.app",
  "https://id-preview--0632b21f-b411-4099-aa84-6a2ca5449ebe.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const EXTRA = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED = new Set([...DEFAULT_ALLOWED, ...EXTRA]);

function corsFor(origin: string | null) {
  const allow = origin && (ALLOWED.has(origin) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const Schema = z.object({
  kind: z.enum(["tour", "application", "compare"]),
  listing_ids: z.array(z.string().uuid()).min(1).max(4),
  extra: z.string().max(500).optional(),
});

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsFor(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!cors["Access-Control-Allow-Origin"]) return json({ error: "forbidden" }, 403, cors);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) return json({ error: "server_error" }, 500, cors);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401, cors);

    let raw: unknown;
    try { raw = await req.json(); } catch { return json({ error: "invalid_request" }, 400, cors); }
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_request" }, 400, cors);
    const { kind, listing_ids, extra } = parsed.data;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "unauthorized" }, 401, cors);

    // RLS scopes to this user
    const { data: items } = await userClient
      .from("external_listings").select("*").in("id", listing_ids);
    if (!items || items.length === 0) return json({ error: "not_found" }, 404, cors);

    const { data: profile } = await userClient
      .from("profiles").select("full_name,budget_min,budget_max,bedrooms,pet_friendly,preferred_state")
      .eq("id", userRes.user.id).maybeSingle();

    const summary = items.map((l: any, i: number) => {
      const bits = [
        l.title || "Untitled listing",
        l.location || "",
        l.price_monthly ? `$${l.price_monthly}/mo` : "",
        l.bedrooms ? `${l.bedrooms}bd` : "",
        l.bathrooms ? `${l.bathrooms}ba` : "",
        l.notes ? `Notes: ${l.notes}` : "",
        `URL: ${l.url}`,
      ].filter(Boolean).join(" · ");
      return `Listing ${i + 1}: ${bits}`;
    }).join("\n");

    const profileLine = profile
      ? `Renter profile: ${profile.full_name || "the user"}, budget $${profile.budget_min ?? "?"}-$${profile.budget_max ?? "?"}, ${profile.bedrooms ?? "?"}bd, pets: ${profile.pet_friendly ? "yes" : "no"}, target: ${profile.preferred_state ?? "any"}.`
      : "Renter profile: not provided.";

    const prompts: Record<string, string> = {
      tour: `Write a short, friendly inquiry message (under 120 words) the renter can send to a landlord/agent to request a tour for the FIRST listing only. Mention move-in flexibility, briefly introduce the renter, and ask 1-2 clarifying questions. No fluff, no markdown headers.`,
      application: `Write a one-paragraph rental application cover letter (under 150 words) for the FIRST listing. Warm, professional. Mention employment stability, on-time rent history, and care for the property. End with availability for a call or tour.`,
      compare: `Compare these ${items.length} listings side-by-side. Output as: brief pros/cons per listing in 1-2 lines each, then a final "Recommendation:" line with the best pick and why. Keep total under 220 words. Use plain text with simple bullets, no markdown headers.`,
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You are a helpful rental assistant. Be concise, warm, and practical. Never invent prices or addresses not in the data.` },
          { role: "user", content: `${profileLine}\n\n${summary}\n\nUser note: ${extra || "(none)"}\n\nTask: ${prompts[kind]}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "rate_limit" }, 429, cors);
      if (aiRes.status === 402) return json({ error: "payment_required" }, 402, cors);
      console.error("ai err", aiRes.status, await aiRes.text());
      return json({ error: "server_error" }, 500, cors);
    }
    const data = await aiRes.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return json({ text }, 200, cors);
  } catch (e) {
    console.error("agent-draft", e);
    return json({ error: "server_error" }, 500, cors);
  }
});

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
