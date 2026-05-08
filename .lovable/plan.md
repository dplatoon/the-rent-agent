# Master Audit — Status & Next Plan

## ✅ What's complete

**Share workflow (end-to-end)**

- `external_listings.share_token` (uuid) generated per row.
- Owner opens **Share dialog** in `/imports` → picks expiry (`never / 1h / 24h / 7d / 30d`) + toggles "Hide sensitive details" (notes, exact address, original URL).
- Settings persist to `share_expires_at` + `share_mask_sensitive` columns.
- Public viewer at `/imports/share/$token`:
  - Calls SECURITY DEFINER RPC `get_shared_listing(_token uuid)`.
  - Server enforces expiry → returns `expired=true` row → UI shows "Link expired" with timestamp.
  - Server enforces masking → strips `notes`, `url`, and reduces `location` to last comma segment.
  - Invalid/unknown token → "Link not found".
  - Page is `noindex`, includes copy-link button.
- Row badges in `/imports` list show `MASKED` and `EXPIRES` indicators.

**Security hardening (audit items #1–#3, #8–#10)**

- Dropped bogus public `SELECT` on `external_listings`; access only via RPC.
- URL validation: client (`isSafeHttpUrl`) + DB trigger (`http(s)://` only, ≤2048 chars).
- Length caps + 500-row per-user cap on `external_listings` and `reminders` (validation triggers, not CHECK constraints).
- Memory updated: shared-listing RPC contract is invariant.

**Agent-draft architecture (audit #4, #6)**

- Migrated `agent-draft` edge function → `src/lib/agent-draft.functions.ts` (`createServerFn` + `requireSupabaseAuth`).
- Daily quota via `consume_daily_draft` RPC (10/day free, unlimited paid, 24h rolling reset).
- Quota widget on `/imports` with progress bar, tier label, time-to-reset, upgrade CTA.
- Auto-refresh: 60s interval + `visibilitychange` + `focus`.
- Edge function + `[functions.agent-draft]` config removed.

---

## 🟡 Remaining gaps (from audit, not yet shipped)

### High

1. **Route auth gating** — `/imports`, `/reminders`, `/saved`, `/dashboard` still redirect from inside `useEffect`. Should use `_authenticated/` layout with `beforeLoad` so loaders/server fns don't 401 on first paint and there's no flash of authed UI.
2. `**agent-draft` prompt size** — for `compare` with 4 listings, `notes` is concatenated unbounded. Cap each listing's notes to ~300 chars before stitching.
3. `**reminders` indexing** — missing index on `(user_id, due_at)` for ordered queries; also no upper bound on `due_at`.

### Medium

4. **Compare draft flash** — re-opening Compare briefly shows previous `draftText`. Already partly handled (`setDraftText("")` in `runDraft`); verify and add reset on dialog close too.
5. **Quick-copy share button regression** — old one-click copy was replaced by settings dialog. Add a split: primary click = copy link, secondary icon = open settings.
6. `**useEffect(() => load(), [])` pattern** in 3 routes — wrap `load` in `useCallback` or move to a query lib (`@tanstack/react-query`).
7. **Share page `og:` tags** — currently blank social previews. Either add server-rendered preview or document as intentional.
8. **No tests** for `external-listings.ts`, `imports`, `reminders`, or `agent-draft.functions.ts`.

### Low / polish

9. `imports.tsx` `setTimeout` cleanup for "copied" state on share page (minor leak).
10. `expiryToDate` exhaustive type for unknown values.
11. Document threat model on share page: "soft hide" (price + bd/ba still visible, URL search can leak address).

---

## 🎯 Proposed next build pass

Pick **one** of these focused slices — recommend Slice A (highest user-visible + security ROI):

### Slice A — Auth gating + share UX polish (recommended)

1. Create `src/routes/_authenticated.tsx` layout with `beforeLoad` session check → redirect `/auth`.
2. Move `/imports`, `/reminders`, `/saved`, `/dashboard` under `_authenticated/`.
3. Restore one-click copy on the share button in the imports list (split: copy on click, settings on long-press / secondary icon).
4. Cap `compare` prompt notes to 300 chars in `agent-draft.functions.ts`.
5. Add `(user_id, due_at)` index on `reminders` (migration).

### Slice B — Test coverage

1. Vitest tests for `get_shared_listing` RPC (valid / expired / masked / missing / bad uuid).
2. Tests for `isSafeHttpUrl`, `detectSource`, `expiryToDate`.
3. Server fn tests for `draftAgentMessage` quota paths (allowed, exhausted, paid tier).

### Slice C — Share page polish

1. Add `og:` / `twitter:` meta on share page (server-rendered title, price, location).
2. Document threat model inline.
3. Cleanup `setTimeout`, exhaustive expiry type.

### Technical notes

- `_authenticated` layout uses `supabase.auth.getUser()` in `beforeLoad` — see TanStack Supabase integration doc in context. Critical for any future server fn loaders.
- Compare-prompt cap goes in `agent-draft.functions.ts` `.handler()` before stitching listing rows.
- Reminders index: `CREATE INDEX idx_reminders_user_due ON public.reminders(user_id, due_at);`

---

**Which slice should I build next?** (A recommended.) Ok Lets do whaen done share me sext step

&nbsp;