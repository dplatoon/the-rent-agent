## Audit: InstallButton (current state)

**What works well**
- Clean detection of three install paths: `beforeinstallprompt` (Chrome/Edge/Android), iOS Safari fallback, unsupported browsers.
- Standalone detection covers both `display-mode: standalone` and iOS `navigator.standalone`.
- "Just installed" pill with dismiss + 24h localStorage persistence (`pwa:installedAt`, `pwa:pillDismissedAt`).
- iOS popover with concrete Share → Add to Home Screen steps.
- Manifest is valid and minimal: `display: standalone`, theme color, scope, maskable icons.
- Project correctly avoids `vite-plugin-pwa` / service workers — matches Lovable PWA guidance (manifest-only is the safer path for installability without offline).

**Issues / gaps found**

1. **5-second auto-dismiss timer was removed.** Earlier turn added `setTimeout(() => setJustInstalled(false), 5000)` in `onInstalled`. Current file no longer has it — the pill now persists indefinitely until the user clicks X. Either intentional (persistence took over) or a regression. Worth confirming.
2. **`justInstalled` can show even when `deferred` is null but install happened in another tab** — fine, but no cross-tab sync (storage event listener missing).
3. **iOS detection misses in-app browsers** (Chrome iOS, Instagram, FB) where Add to Home Screen won't work. Popover footer mentions it, but the button still says "Install on iOS" — could mislead.
4. **No analytics/telemetry hook** for prompt shown / accepted / dismissed — common ask after shipping install UI.
5. **No manual re-trigger path** if user dismissed the native prompt once. Chrome won't re-fire `beforeinstallprompt` for ~90 days; users have no way back in.
6. **Icon quality**: manifest points only at `/favicon.png` for both 192 and 512 with `purpose: "any maskable"`. A single small favicon stretched to 512 + used as a maskable icon usually looks bad on Android home screens (no safe zone padding). Should ship dedicated 192/512 PNGs and ideally split `any` and `maskable` purposes.
7. **No `id` field in manifest** — recommended so Chrome can stably identify the PWA across `start_url` changes.
8. **A11y**: pill is a `<span>` containing a `<button>` — fine, but the pill itself has no `role="status"` / `aria-live`, so screen readers won't announce "Installed!".
9. **No screenshots in manifest** — required for richer Android install UI ("Install app" dialog with preview).

---

## Recommended next implementation

Pick one of three directions. I'd recommend **Option A** as the highest-impact, lowest-risk next step.

### Option A — Polish the install experience (recommended)
- Restore the 5s auto-dismiss as a fallback (keep manual X + persistence).
- Add `role="status" aria-live="polite"` to the pill.
- Improve manifest:
  - add `"id": "/"`,
  - split icons into a dedicated `maskable` entry and `any` entry,
  - generate proper 192×192 and 512×512 PNGs (instead of reusing favicon),
  - add 1–2 `screenshots` entries for Android install dialog.
- Detect in-app browsers on iOS and swap the button label to "Open in Safari to install" with copy-link fallback.

### Option B — Re-engagement after dismissal
- Track dismissal of the native prompt; surface a subtle "Install app" link in the footer or a dismissible banner after N visits, since Chrome won't re-fire `beforeinstallprompt` automatically.
- Add a "Why install?" popover (offline-ready home screen icon, faster launch).

### Option C — Telemetry
- Log `pwa_prompt_shown`, `pwa_prompt_accepted`, `pwa_prompt_dismissed`, `pwa_installed`, `pwa_pill_dismissed` events to Lovable Cloud (insert into a small `pwa_events` table) so you can measure install funnel.

---

## Question for you

Which direction should I plan in detail?
1. **A — Polish** (manifest icons + a11y + restore auto-dismiss + in-app browser detection)
2. **B — Re-engagement banner** for users who dismissed the native prompt
3. **C — Install funnel telemetry** in Lovable Cloud
4. Something else (tell me)
