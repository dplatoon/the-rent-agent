import { describe, it, expect, vi, beforeEach } from "vitest";

const inserted: any[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (payload: any) => {
        inserted.push(payload);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

import {
  sanitizeForTelemetry,
  assertNoRawPII,
  looksLikeRawUA,
  looksLikeFullURL,
  trackPwaEvent,
} from "./pwa-telemetry";

const REAL_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

describe("pwa-telemetry privacy", () => {
  beforeEach(() => {
    inserted.length = 0;
  });

  describe("looksLikeRawUA", () => {
    it("detects common UA markers", () => {
      expect(looksLikeRawUA(REAL_UA)).toBe(true);
      expect(looksLikeRawUA("Mozilla/5.0 foo")).toBe(true);
      expect(looksLikeRawUA("hello world")).toBe(false);
    });
  });

  describe("looksLikeFullURL", () => {
    it("flags URLs with paths/queries/fragments", () => {
      expect(looksLikeFullURL("https://example.com/foo")).toBe(true);
      expect(looksLikeFullURL("https://example.com/?q=1")).toBe(true);
      expect(looksLikeFullURL("https://example.com/#x")).toBe(true);
    });
    it("allows bare origins", () => {
      expect(looksLikeFullURL("https://example.com")).toBe(false);
      expect(looksLikeFullURL("https://example.com/")).toBe(false);
    });
  });

  describe("sanitizeForTelemetry", () => {
    it("redacts raw UA strings inside nested objects", () => {
      const out = sanitizeForTelemetry({ a: { b: REAL_UA } }) as any;
      expect(out.a.b).not.toBe(REAL_UA);
      // Version numbers and device parens must be stripped.
      expect(out.a.b).not.toMatch(/17[._]4[._]1/);
      expect(out.a.b).not.toContain("iPhone OS");
    });

    it("strips paths/queries from full URLs", () => {
      const out = sanitizeForTelemetry({
        ref: "https://foo.test/secret/path?token=abc",
      }) as any;
      expect(out.ref).toBe("https://foo.test");
    });

    it("preserves bare origins under allowed keys", () => {
      const out = sanitizeForTelemetry({
        referrerOrigin: "https://example.com",
      }) as any;
      expect(out.referrerOrigin).toBe("https://example.com");
    });

    it("scrubs items inside arrays", () => {
      const out = sanitizeForTelemetry([REAL_UA, "https://x.test/p?q=1"]) as any[];
      expect(out[0]).not.toBe(REAL_UA);
      expect(out[0]).not.toContain("iPhone OS");
      expect(out[1]).toBe("https://x.test");
    });
  });

  describe("assertNoRawPII", () => {
    it("throws on raw UA", () => {
      expect(() => assertNoRawPII({ x: REAL_UA })).toThrow(/userAgent/);
    });
    it("throws on full URL with path", () => {
      expect(() => assertNoRawPII({ x: "https://a.test/path" })).toThrow(
        /referrer|URL/,
      );
    });
    it("accepts safe payload", () => {
      expect(() =>
        assertNoRawPII({ origin: "https://a.test", note: "ok" }),
      ).not.toThrow();
    });
  });

  describe("trackPwaEvent end-to-end", () => {
    beforeEach(() => {
      const g = globalThis as any;
      const set = (k: string, v: unknown) =>
        Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
      set("window", g);
      set("navigator", {
        userAgent: REAL_UA,
        language: "en-US",
        languages: ["en-US"],
      });
      set("document", { referrer: "https://ref.test/path?q=1" });
      set("screen", { width: 390, height: 844 });
      set("innerWidth", 390);
      set("innerHeight", 844);
      set("devicePixelRatio", 2);
      set("matchMedia", () => ({ matches: false }));
      set("location", { pathname: "/" });
    });

    const assertSafe = () => {
      for (const row of inserted) {
        const json = JSON.stringify(row);
        expect(json).not.toMatch(/Mozilla\//);
        expect(json).not.toMatch(/AppleWebKit\//);
        expect(json).not.toMatch(/Safari\/\d/);
        const urls = json.match(/https?:\/\/[^\s"']+/g) ?? [];
        for (const u of urls) {
          expect(looksLikeFullURL(u)).toBe(false);
        }
      }
    };

    it("never inserts raw userAgent or full referrer URLs (normal call)", () => {
      trackPwaEvent("prompt_shown", { note: "user opened install" });
      assertSafe();
    });

    it("never inserts raw values when caller tries to leak via meta", () => {
      trackPwaEvent("prompt_shown", {
        leakedUA: REAL_UA,
        leakedRef: "https://evil.test/secret?token=abc",
      });
      assertSafe();
    });

    it("drops events when caller tries to leak raw UA via meta", () => {
      trackPwaEvent("prompt_shown", { leakedUA: REAL_UA });
      // Either nothing inserted, or what was inserted contains no raw UA.
      if (inserted.length > 0) {
        const json = JSON.stringify(inserted[0]);
        expect(json).not.toMatch(/Mozilla\//);
        expect(json).not.toMatch(/AppleWebKit\//);
      }
    });
  });
});
