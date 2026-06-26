text
# Plan: Add Demo Link + Stripe Pricing Preview

## Goal
Add a "Demo" link in the site header that opens a preview of the paid plans (Free / Pro / Premium). The page should show the Stripe pricing details now, while the actual Stripe checkout integration stays in a safe demo/pending state until the user is ready to connect it.

## What will be changed

### 1. Add "Demo" link to the header
- File: `src/components/SiteHeader.tsx`
- Insert a new `Demo` link in the main navigation, next to the existing links.
- Link target: `/pricing` (the existing pricing page already displays the tier details).

### 2. Make the pricing page safe before Stripe is connected
- File: `src/routes/pricing.tsx`
- Add a top-of-page banner or badge that says the checkout is in demo mode / Stripe not yet configured.
- Change the Pro/Premium checkout buttons so that, when the `create-checkout` edge function is not configured or returns an error, they show a friendly message like "Stripe checkout coming soon" instead of a broken/failing flow.
- Keep the Free tier button pointing to `/auth` (sign-up) as it already does.
- No actual Stripe keys or secrets are required at this stage.

### 3. Next steps the user will take later (no code change now)
When the user is ready to enable real payments, they will follow the existing `STRIPE_SETUP.md` steps:
1. Create Pro ($9/mo) and Premium ($19/mo) products in Stripe.
2. Set Supabase Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM`, `APP_URL`.
3. Apply migrations and deploy the `create-checkout` and `stripe-webhook` functions.
4. Register the Stripe webhook endpoint and set `STRIPE_WEBHOOK_SECRET`.
5. Test with Stripe test card `4242 4242 4242 4242`.

## Outcome
- The navigation shows a "Demo" link.
- The pricing page displays the three tiers and explains checkout is coming soon.
- Nothing will break if Stripe is not connected yet.
- After this turn, the user can continue with the Stripe setup from `STRIPE_SETUP.md`.