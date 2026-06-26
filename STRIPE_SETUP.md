# Stripe Billing — Setup & Deploy

This wires the existing `free` / `pro` / `premium` tiers to real payments.
Nothing about pricing is hardcoded to dollars in the backend — the plan is
defined by the Stripe Price you create, and the webhook is the only thing that
can change a user's `tier`.

## 1. Create products in Stripe

In the Stripe Dashboard (start in **Test mode**):

1. Products → add **Pro** with a recurring monthly price ($9). Copy its
   Price ID (`price_...`).
2. Add **Premium** with a recurring monthly price ($19). Copy its Price ID.

## 2. Set Supabase Edge Function secrets

These are server-only — never put them in `.env` or the repo.

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_PRICE_PRO=price_xxx
supabase secrets set STRIPE_PRICE_PREMIUM=price_xxx
supabase secrets set APP_URL=https://the-rent-agent.lovable.app
# STRIPE_WEBHOOK_SECRET is set in step 4, after the endpoint exists.
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically by Supabase for edge functions.

## 3. Apply migrations & deploy functions

```
supabase db push                       # adds consume_daily_chat + stripe columns
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

## 4. Register the webhook in Stripe

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://<PROJECT_ID>.supabase.co/functions/v1/stripe-webhook`
   (your PROJECT_ID is `trakpcquqrdiubnglxdi`).
3. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the endpoint's **Signing secret** (`whsec_...`) and set it:
   ```
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   supabase functions deploy stripe-webhook   # redeploy so it picks up the secret
   ```

## 5. Test the flow

1. Run the app, sign in, go to `/pricing`, click **Go Pro**.
2. Use Stripe test card `4242 4242 4242 4242`, any future expiry/CVC.
3. After payment you'll land on `/dashboard?checkout=success`.
4. Confirm the webhook fired (Stripe → Webhooks → recent deliveries = 200) and
   that the user's `profiles.tier` is now `pro`.

## 6. Go live

Swap the test keys/prices for live ones (`sk_live_...`, live Price IDs),
re-create the webhook endpoint in live mode, and update the three secrets.

---

## What this does NOT include yet (next steps)

- **Customer Portal** (let users cancel/update cards themselves). One more
  small edge function calling `stripe.billingPortal.sessions.create`.
- **Proration/upgrades** between Pro and Premium from inside the app.
- **Dunning UX** — `subscription_status` is stored on the profile; surface
  `past_due` to the user with a "fix your payment" banner.

Tell me if you want the Customer Portal added — it's ~30 lines.
