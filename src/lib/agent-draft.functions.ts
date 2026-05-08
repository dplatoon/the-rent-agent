import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  kind: z.enum(["tour", "application", "compare"]),
  listing_ids: z.array(z.string().uuid()).min(1).max(4),
  extra: z.string().max(500).optional(),
});

export type DraftResult =
  | { ok: true; text: string; remaining: number; tier: string }
  | { ok: false; error: "rate_limit" | "payment_required" | "quota_exceeded" | "not_found" | "server_error" | "invalid_request"; remaining?: number };

function clip(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export type DraftQuota = {
  tier: string;
  used: number;
  limit: number;
  remaining: number;
  reset_at: string; // ISO; when the 24h window rolls over
};

export const DRAFT_DAILY_LIMIT = 10;

export const getDraftQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DraftQuota> => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("profiles")
      .select("tier,daily_draft_count,daily_draft_reset_at")
      .eq("id", userId)
      .maybeSingle();

    const tier = p?.tier ?? "free";
    const resetStart = p?.daily_draft_reset_at ? new Date(p.daily_draft_reset_at) : new Date();
    const now = Date.now();
    const expired = now - resetStart.getTime() > 24 * 3600e3;
    const used = expired ? 0 : (p?.daily_draft_count ?? 0);
    const limit = DRAFT_DAILY_LIMIT;
    const reset_at = new Date((expired ? now : resetStart.getTime()) + 24 * 3600e3).toISOString();
    const remaining = tier === "free" ? Math.max(limit - used, 0) : limit;
    return { tier, used: tier === "free" ? used : 0, limit, remaining, reset_at };
  });

export const draftAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }): Promise<DraftResult> => {
    const { kind, listing_ids, extra } = data;
    const userId = context.userId;
    const supabase = context.supabase;

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) return { ok: false, error: "server_error" };

    // Quota check (server-side, service role bypasses RLS)
    const { data: quota, error: qErr } = await supabaseAdmin.rpc("consume_daily_draft", {
      _user_id: userId,
      _limit: 10,
    });
    if (qErr) {
      console.error("quota err", qErr);
      return { ok: false, error: "server_error" };
    }
    const row = Array.isArray(quota) ? quota[0] : quota;
    if (!row?.allowed) {
      return { ok: false, error: "quota_exceeded", remaining: 0 };
    }

    // RLS-scoped fetch via user-bound client
    const { data: items } = await supabase
      .from("external_listings")
      .select("*")
      .in("id", listing_ids);
    if (!items || items.length === 0) return { ok: false, error: "not_found" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,budget_min,budget_max,bedrooms,pet_friendly,preferred_state")
      .eq("id", userId)
      .maybeSingle();

    const notesCap = kind === "compare" ? 200 : 300;
    const summary = items.map((l: any, i: number) => {
      const bits = [
        clip(l.title, 120) || "Untitled listing",
        clip(l.location, 120),
        l.price_monthly ? `$${l.price_monthly}/mo` : "",
        l.bedrooms ? `${l.bedrooms}bd` : "",
        l.bathrooms ? `${l.bathrooms}ba` : "",
        l.notes ? `Notes: ${clip(l.notes, notesCap)}` : "",
        `URL: ${clip(l.url, 200)}`,
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
          { role: "user", content: `${profileLine}\n\n${summary}\n\nUser note: ${clip(extra, 500) || "(none)"}\n\nTask: ${prompts[kind]}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return { ok: false, error: "rate_limit" };
      if (aiRes.status === 402) return { ok: false, error: "payment_required" };
      console.error("ai err", aiRes.status, await aiRes.text());
      return { ok: false, error: "server_error" };
    }
    const json = await aiRes.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    return { ok: true, text, remaining: row.remaining ?? 0, tier: row.tier ?? "free" };
  });
