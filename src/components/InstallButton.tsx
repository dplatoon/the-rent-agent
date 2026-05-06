import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Share, Plus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trackPwaEvent } from "@/lib/pwa-telemetry";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad =
    /iPad/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  return /iPhone|iPod/.test(ua) || isIPad;
}

function detectIOSInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Safari on iOS contains "Safari" and "Version/". In-app browsers (Chrome iOS = CriOS,
  // Firefox iOS = FxiOS, Edge iOS = EdgiOS, Instagram, FB, Line, etc.) do not.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)) return true;
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|Pinterest/i.test(ua)) return true;
  return false;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) {
      setInstalled(true);
      // On load while installed, only show the pill if a recent install
      // happened and the user hasn't dismissed it.
      try {
        const installedAt = Number(localStorage.getItem("pwa:installedAt") || 0);
        const dismissedAt = Number(localStorage.getItem("pwa:pillDismissedAt") || 0);
        const fresh = installedAt && Date.now() - installedAt < 1000 * 60 * 60 * 24;
        if (fresh && dismissedAt < installedAt) setJustInstalled(true);
      } catch {}
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setSupported(true);
      trackPwaEvent("prompt_shown");
    };
    const onInstalled = () => {
      setInstalled(true);
      setJustInstalled(true);
      setDeferred(null);
      try {
        localStorage.setItem("pwa:installedAt", String(Date.now()));
        localStorage.removeItem("pwa:pillDismissedAt");
      } catch {}
      trackPwaEvent("installed");
      window.setTimeout(() => setJustInstalled(false), 5000);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pwa:pillDismissedAt") setJustInstalled(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("storage", onStorage);

    const t = window.setTimeout(() => {
      setSupported((prev) => (prev === null ? false : prev));
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(t);
    };
  }, []);

  const dismissPill = () => {
    setJustInstalled(false);
    try {
      localStorage.setItem("pwa:pillDismissedAt", String(Date.now()));
    } catch {}
    trackPwaEvent("pill_dismissed");
  };

  if (installed) {
    if (justInstalled) {
      return (
        <span role="status" aria-live="polite" className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 pl-2.5 pr-1 py-1 text-xs font-medium text-primary animate-in fade-in slide-in-from-top-1 duration-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Installed!
          <button
            type="button"
            onClick={dismissPill}
            aria-label="Dismiss"
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        App installed
      </span>
    );
  }

  if (deferred) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          trackPwaEvent(outcome === "accepted" ? "prompt_accepted" : "prompt_dismissed");
          if (outcome === "accepted") setDeferred(null);
        }}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </Button>
    );
  }

  if (isIOS) {
    const inApp = detectIOSInAppBrowser();
    return (
      <Popover onOpenChange={(o) => { if (o) trackPwaEvent(inApp ? "ios_open_in_safari" : "ios_help_opened"); }}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Share className="h-3.5 w-3.5" />
            {inApp ? "Open in Safari" : "Install on iOS"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <div className="font-semibold mb-2">
            {inApp ? "Open this page in Safari" : "Add to Home Screen"}
          </div>
          {inApp ? (
            <>
              <p className="text-muted-foreground text-xs mb-3">
                You're in an in-app browser, which can't install web apps.
                Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />
                menu and choose <strong>Open in Safari</strong>, then use Share → Add to Home Screen.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                }}
                className="w-full rounded-md border border-border/60 bg-muted/30 hover:bg-muted/50 transition px-3 py-2 text-xs font-medium"
              >
                Copy link to open in Safari
              </button>
            </>
          ) : (
          <>
          <p className="text-muted-foreground text-xs mb-3">
            iOS doesn't allow one-tap install. Use Safari's Share menu:
          </p>
          <ol className="space-y-2 text-xs">
            <li className="flex gap-2">
              <span className="font-mono text-primary">1.</span>
              <span className="flex-1">
                Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />
                <strong> Share</strong> button in Safari's toolbar.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">2.</span>
              <span className="flex-1">
                Scroll and tap <Plus className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />
                <strong> Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">3.</span>
              <span className="flex-1">
                Tap <strong>Add</strong> in the top-right corner.
              </span>
            </li>
          </ol>
          <p className="text-muted-foreground text-[11px] mt-3 border-t border-border/50 pt-2">
            Note: this only works in Safari, not Chrome or in-app browsers.
          </p>
          </>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  if (supported === false) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            Install help
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <div className="font-semibold mb-2">Install not available</div>
          <p className="text-muted-foreground text-xs">
            Your browser doesn't expose a one-click install. Try opening this site
            in Chrome, Edge, or Safari (iOS) — then look for "Install app" or
            "Add to Home Screen" in the browser menu.
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  return null;
}
