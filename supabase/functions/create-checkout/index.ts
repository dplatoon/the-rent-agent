// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout Session (subscription mode) for the signed-in user.
// Auth is enforced here (config.toml sets verify_jwt = false, same as agent-chat).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

const DEFAULT_ALLOWED = [
  "https://the-rent-agent.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const EXTRA = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED, ...EXTRA]);

function corsFor(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin))
    ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const PayloadSchema = z.object({ tier: z.enum(["pro", "premium"]) });

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsFor(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!cors["Access-Control-Allow-Origin"]) return json({ error: "forbidden" }, 403, cors);

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APP_URL = Deno.env.get("APP_URL") || origin || "https://the-rent-agent.lovable.app";
    const PRICES: Record<string, string | undefined> = {
      pro: Deno.env.get("STRIPE_PRICE_PRO"),
      premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
    };
    if (!STRIPE_SECRET_KEY) { console.error("STRIPE_SECRET_KEY missing"); return json({ error: "server_error" }, 500, cors); }

    // --- Authenticate the user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, cors);

    let raw: unknown;
    try { raw = await req.json(); } catch { return json({ error: "invalid_request" }, 400, cors); }
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_request" }, 400, cors);
    const { tier } = parsed.data;

    const priceId = PRICES[tier];
    if (!priceId) { console.error(`price id for tier '${tier}' not configured`); return json({ error: "server_error" }, 500, cors); }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401, cors);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // --- Reuse or create the Stripe customer ---
    const { data: prof } = await admin.from("profiles")
      .select("stripe_customer_id, email").eq("id", user.id).maybeSingle();

    let customerId = prof?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? prof?.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // --- Create the Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      // Propagate identity to the subscription so the webhook can map it back.
      subscription_data: { metadata: { supabase_user_id: user.id, tier } },
      metadata: { supabase_user_id: user.id, tier },
      success_url: `${APP_URL}/dashboard?checkout=success`,
      cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return json({ url: session.url }, 200, cors);
  } catch (e) {
    console.error("create-checkout error", e);
    return json({ error: "server_error" }, 500, cors);
  }
});
