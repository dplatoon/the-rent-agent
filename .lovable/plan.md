# Core Audit — Bugs, Errors, Gaps

Focused on the recently shipped imports / share / reminders / agent-draft slice (the area most likely to harbor regressions). Severity in brackets.

## 🔴 Critical security bugs

### 1. `external_listings` is publicly readable end-to-end — token check is fake
`supabase/migrations/...142609.sql`:
```sql
create policy "public view by share token"
  on public.external_listings for select
  using (true);
```
The comment claims "token is unguessable uuid; app only queries `.eq('share_token', token)`." That's wrong — **RLS doesn't enforce a client query filter**. `using (true)` lets any anonymous user run `select * from external_listings` and dump every user's saved URLs, notes, prices, locations, share tokens, and `user_id`s.

Fix: replace with a token-bound predicate, e.g.
```sql
using (share_token::text = current_setting('request.jwt.claims', true)::json->>'share_token'
       OR auth.uid() = user_id)
```
or — simpler and matches the actual flow — drop the public SELECT policy entirely and serve shares through a SECURITY DEFINER RPC `get_shared_listing(token uuid)` that returns one row, enforces expiration, and applies masking server-side.

### 2. Share expiration is enforced only in the browser
`src/lib/external-listings.ts::fetchSharedImport` checks `share_expires_at` after fetching. With #1 fixed via RLS, an attacker can still bypass the check by calling Supabase REST directly — the row is returned regardless of expiry. Expiration must be enforced in SQL (`using (share_expires_at is null or share_expires_at > now())`) or in the SECURITY DEFINER RPC.

### 3. Sensitive-info masking is also client-side only
`maskSensitive()` runs in the browser. The full row (notes, exact `location`, original `url`) is sent over the wire and visible in DevTools/network even when "Hide sensitive details" is on. Must be done in the same RPC so the server returns only the redacted projection.

## 🟠 High-severity bugs

### 4. `agent-draft` edge function is dead code in this stack
The project knowledge says: **Do NOT use Supabase Edge Functions in TanStack Start; use `createServerFn`.** `supabase/functions/agent-draft/index.ts` exists and `imports.tsx` POSTs to `/functions/v1/agent-draft`. This works today but violates the architecture rule, complicates auth, and skips the platform's normal request pipeline. Should be ported to `src/lib/agent-draft.functions.ts` with `requireSupabaseAuth` middleware.

### 5. Origin allowlist hardcodes a preview URL
`agent-draft/index.ts` hardcodes `id-preview--0632b21f-...lovable.app`. The regex `^https:\/\/[a-z0-9-]+\.lovable\.app$` already covers it; the hardcoded string will rot if the project ID changes. Same for `the-rent-agent.lovable.app` if the user renames.

### 6. No rate limiting on `agent-draft`
Anyone with a session can spam tour/application/compare drafts and burn LOVABLE_API_KEY credits. There's a `consume_daily_chat()` function for the chat tier — drafts should consume the same (or a sibling) quota. Currently unbounded.

### 7. `Listing comparison` modal will open and stay open even on AI failure for non-rate-limit/payment errors
In `runDraft`, on `!r.ok` it sets `setDraftOpen(null)` — good. But on a thrown network error (catch branch) it also closes and toasts — fine. However the `finally { setDrafting(false) }` runs after `setDraftOpen(null)`, leaving an instant where `drafting=false` and `draftOpen=null` together — okay, but `draftText` is never cleared on subsequent open if a previous run succeeded. Re-opening "Compare" briefly flashes the old draft text before the new request resolves. Clear `draftText` on open, not on success.

### 8. No URL validation in the imports `add()` beyond `new URL(...)`
A user can save `javascript:alert(1)` — passes `new URL`, gets stored, then `<a href={item.url}>` on the share page runs script when clicked. Restrict to `http:`/`https:` only.

### 9. No length / count caps on `external_listings.notes`, `title`, `location`, `url`
A single user can store unlimited rows of unbounded text. Add column length checks (`url` ≤ 2048, `title` ≤ 200, `location` ≤ 200, `notes` ≤ 2000) and a per-user row cap (e.g., 200) via trigger.

### 10. `reminders` has no validation either
- `due_at` can be any past date with no bound.
- `title`/`notes` unbounded.
- No row cap.
- Missing index on `(user_id, due_at)` for the ordered query in `RemindersPage.load`.

## 🟡 Medium

### 11. Race-condition / no auth gate on routes
`/imports`, `/reminders`, `/saved`, `/dashboard` all redirect to `/auth` from inside a `useEffect`. Page renders form/buttons for a tick before redirect, and the loader of any future server-fn would 401. Per the project's TanStack guidance, gate via the `_authenticated` layout pattern (or at minimum `beforeLoad: () => supabase.auth.getUser()`). Same memo notes "Client-side-only auth checks on /dashboard and /saved are acceptable" — but new routes (`/imports`, `/reminders`) inherit the same pattern; document or fix consistently.

### 12. Share page shows the same "expired" message for two different states pre-fix
Currently distinguishes `expired` vs `missing` — good. But because of bug #1, even a deleted/expired link still resolves (any row is readable). Fix #1 first.

### 13. `share_mask_sensitive` mask leaves price + bedrooms/bathrooms exposed
"Hide sensitive details" hides notes + URL + reduces location to last comma segment. Price and bd/ba pass through. If "sensitive" includes contact info, the original URL itself often contains the listing id which a viewer can search to recover the address. Document the threat model — mask is "soft hide" not "private."

### 14. Copy-share button in the imports list was replaced by a settings dialog opener; users lose the one-click copy
Old behavior: click Share2 → copies link. New behavior: click → opens dialog → click Copy. One extra click. Consider a split button or keep a quick-copy in the row and put settings on a secondary icon.

### 15. `useEffect(() => { load(); }, [])` with `// eslint-disable-next-line` in 3 routes
Fragile pattern — `load` closes over `navigate`. Wrap in `useCallback` or move into a query lib. Same bug exists in `imports.tsx`, `reminders.tsx`, `saved.tsx`.

### 16. `agent-draft` accepts up to 4 listings but truncates prompts blindly
For `compare` with 4 listings each having long notes, the prompt may exceed reasonable token budgets. Cap each listing's `notes` to ~300 chars before stitching.

### 17. `external_listings` has no `title`/`url` not-null constraints on the storage layer that match UI assumptions
UI shows `l.title || l.url`, fine; but `share` page renders `item.url` in an `<a>` with no validation against bug #8.

### 18. `imports.share.$token.tsx` uses `setTimeout` for "copied" reset without cleanup
Minor leak if user navigates away mid-toast.

### 19. SEO/meta on share page is `noindex` — good — but no `og:` tags, so social previews are blank. Either add a server-rendered share preview or leave intentionally blank and document.

### 20. No tests for any of: `external-listings.ts`, `imports` route, `reminders` route, `agent-draft` edge function. Existing `*.test.ts` cover only agents/pwa-telemetry.

## 🟢 Low / polish

- `imports.tsx` line 150 builds the function URL with `import.meta.env.VITE_SUPABASE_URL` then path `/functions/v1/agent-draft` — works, but should use the supabase client's `functions.invoke()` to get auto auth + retry semantics.
- `external-listings.ts::SOURCE_META` colors use raw hex (`#006AFF`) in the share page via inline style — violates the design-token rule. Acceptable here because brand colors are external, but should be acknowledged.
- `shareExpiry` state initializer is `"never"`, but `openShare` overwrites — fine; just dead-init noise on first render.
- `expiryToDate` returns `null` for unknown values silently. Add an exhaustive type.
- `ExternalListing.share_mask_sensitive` defaults to `false` server-side ✅ but the imports list UI gives no visual indicator that masking is on for a row. Add a small `EyeOff` badge next to rows where it's enabled.
- `fetchSharedImport` always selects `*` — returns `user_id`, `share_token`, `created_at`, etc. to anonymous viewers (compounds bug #1). Even after the RPC fix, project only the public fields.

## Suggested fix order

1. **Critical, same migration**: drop the bogus public SELECT policy on `external_listings`; add a SECURITY DEFINER RPC `get_shared_listing(token uuid)` that enforces expiry + masking + projects only public columns. Update `fetchSharedImport` to call it.
2. Lock down stored URLs to `http(s):` (UI + SQL CHECK).
3. Add length caps + per-user row caps for `external_listings` and `reminders`.
4. Move `agent-draft` to `createServerFn` and add a draft quota.
5. Switch route auth to `_authenticated` layout.
6. Tests for the shared-listing flow (expired, masked, missing, valid).

If you want, I can start with #1–#3 (the security-critical migration + URL hardening) as the first build pass, then tackle the architecture cleanup separately.
