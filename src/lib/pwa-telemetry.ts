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

export function trackPwaEvent(event: PwaEvent, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    void supabase.from("pwa_events").insert({
      event,
      platform: detectPlatform(),
      user_agent: navigator.userAgent.slice(0, 500),
      meta: (meta ?? null) as never,
    });
  } catch {
    // Telemetry must never break the UX
  }
}
