import { supabase } from "@/integrations/supabase/client";

export type PwaEvent =
  | "prompt_shown"
  | "prompt_accepted"
  | "prompt_dismissed"
  | "installed"
  | "pill_dismissed"
  | "ios_open_in_safari"
  | "ios_copy_link"
  | "ios_help_opened"
  | "unsupported_help_opened";

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Win/.test(ua)) return "windows";
  if (/Mac/.test(ua)) return "mac";
  if (/Linux/.test(ua)) return "linux";
  return "other";
}

// Lightweight, non-cryptographic hash (FNV-1a 32-bit, hex). Stable across
// runs but not reversible — fine for grouping/segmenting without storing PII.
function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Strip versions, build numbers, and long tokens that can fingerprint a user.
function redactUserAgent(ua: string): string {
  return ua
    .replace(/\d+(\.\d+)+/g, "x") // version numbers like 17.4.1 -> x
    .replace(/\b[0-9a-f]{8,}\b/gi, "x") // hex build ids
    .replace(/\([^)]*\)/g, "(x)") // device/OS detail in parens
    .slice(0, 200);
}

// Keep only the origin of the referrer; drop path, query, and fragment to
// avoid leaking private URLs (e.g., password-reset tokens, search queries).
function redactReferrer(ref: string): { origin?: string; hash: string } {
  if (!ref) return { hash: "" };
  try {
    const u = new URL(ref);
    return { origin: u.origin, hash: hashString(ref) };
  } catch {
    return { hash: hashString(ref) };
  }
}

function collectDeviceInfo() {
  if (typeof window === "undefined") return {};
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const rawUA = navigator.userAgent;
  const rawRef = document.referrer || "";
  const ref = redactReferrer(rawRef);
  return {
    userAgent: redactUserAgent(rawUA),
    userAgentHash: hashString(rawUA),
    language: navigator.language,
    languages: navigator.languages?.slice(0, 5),
    screen: {
      width: window.screen?.width,
      height: window.screen?.height,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    orientation:
      window.matchMedia?.("(orientation: portrait)").matches ? "portrait" : "landscape",
    connection: nav.connection?.effectiveType,
    referrerOrigin: ref.origin,
    referrerHash: ref.hash || undefined,
    path: window.location.pathname,
  };
}

// Substrings that must NEVER appear in serialized telemetry payloads. If any
// of these are present we assume the value is a raw UA / full referrer and
// scrub it before insert.
const FORBIDDEN_UA_MARKERS = [
  "Mozilla/",
  "AppleWebKit/",
  "Chrome/",
  "Safari/",
  "Firefox/",
  "Version/",
  "Edg/",
  "CriOS/",
  "FxiOS/",
];

export function looksLikeRawUA(value: string): boolean {
  return FORBIDDEN_UA_MARKERS.some((m) => value.includes(m));
}

export function looksLikeFullURL(value: string): boolean {
  // Allow bare origins (scheme + host, optional port). Anything with a path,
  // query, or fragment is treated as a full referrer and scrubbed.
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return false;
    return u.pathname !== "/" || u.search !== "" || u.hash !== "";
  } catch {
    return false;
  }
}

// Allowed keys that are permitted to contain bare origins.
const ORIGIN_ALLOWED_KEYS = new Set(["referrerOrigin", "origin"]);

export function sanitizeForTelemetry(value: unknown, key = ""): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (looksLikeRawUA(value)) return redactUserAgent(value);
    if (looksLikeFullURL(value) && !ORIGIN_ALLOWED_KEYS.has(key)) {
      try {
        return new URL(value).origin;
      } catch {
        return "[redacted-url]";
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeForTelemetry(v, key));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForTelemetry(v, k);
    }
    return out;
  }
  return value;
}

export function assertNoRawPII(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (!json) return;
  if (looksLikeRawUA(json)) {
    throw new Error("pwa-telemetry: raw userAgent leaked into payload");
  }
  // Detect full URLs with paths/queries — bare origins are allowed.
  const urlMatches = json.match(/https?:\/\/[^\s"']+/g) ?? [];
  for (const url of urlMatches) {
    if (looksLikeFullURL(url)) {
      throw new Error("pwa-telemetry: full referrer/URL leaked into payload");
    }
  }
}

export function trackPwaEvent(event: PwaEvent, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const rawUA = navigator.userAgent;
    const safeUA = redactUserAgent(rawUA);
    const safeMeta = sanitizeForTelemetry({
      device: collectDeviceInfo(),
      ...(meta ?? {}),
    }) as Record<string, unknown>;

    const payload = {
      event,
      platform: detectPlatform(),
      user_agent: safeUA,
      meta: safeMeta,
    };

    // Final guard: if anything slipped past redaction, abort instead of leaking.
    assertNoRawPII(payload);

    void supabase.from("pwa_events").insert(payload as never);
  } catch (err) {
    // Telemetry must never break the UX. Surface validation failures in dev only.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[pwa-telemetry] dropped event", err);
    }
  }
}
