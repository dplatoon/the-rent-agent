// supabase/functions/stripe-webhook/index.ts
// Receives Stripe events, verifies the signature, and is the ONLY place that
// changes a user's tier. Must run with verify_jwt = false (set in config.toml)
// because Stripe calls it without a Supabase JWT — the signature is the auth.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRICE_PRO = Deno.env.get("STRIPE_PRICE_PRO");
const PRICE_PREMIUM = Deno.env.get("STRIPE_PRICE_PREMIUM");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Resolve the plan tier for a subscription, preferring explicit metadata and
// falling back to the configured price ids.
function tierFromSubscription(sub: Stripe.Subscription): "pro" | "premium" | null {
  const metaTier = sub.metadata?.tier;
  if (metaTier === "pro" || metaTier === "premium") return metaTier;
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId && priceId === PRICE_PREMIUM) return "premium";
  if (priceId && priceId === PRICE_PRO) return "pro";
  return null;
}

async function updateByCustomer(customerId: string, fields: Record<string, unknown>) {
  const { error } = await admin.from("profiles").update(fields).eq("stripe_customer_id", customerId);
  if (error) console.error("profile update failed", customerId, error.message);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider,
    );
  } catch (e) {
    console.error("signature verification failed", (e as Error).message);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subId = session.subscription as string | null;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id || undefined;
        let tier = (session.metadata?.tier as string) || "pro";

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          tier = tierFromSubscription(sub) ?? tier;
          await updateByCustomer(customerId, {
            tier, stripe_subscription_id: subId, subscription_status: sub.status,
          });
        } else if (userId) {
          await admin.from("profiles").update({ tier, stripe_customer_id: customerId }).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        // active/trialing keep the plan; anything else (past_due, unpaid,
        // canceled, incomplete_expired) drops the user back to free.
        const live = sub.status === "active" || sub.status === "trialing";
        const tier = live ? (tierFromSubscription(sub) ?? "pro") : "free";
        await updateByCustomer(customerId, {
          tier, stripe_subscription_id: sub.id, subscription_status: sub.status,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        await updateByCustomer(customerId, {
          tier: "free", stripe_subscription_id: null, subscription_status: "canceled",
        });
        break;
      }

      default:
        // Ignore unhandled event types.
        break;
    }
  } catch (e) {
    console.error("webhook handler error", event.type, e);
    // Return 200 so Stripe doesn't retry a handler bug forever; the error is logged.
    return new Response(JSON.stringify({ received: true, handler_error: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
