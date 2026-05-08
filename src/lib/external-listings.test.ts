import { describe, it, expect } from "vitest";
import { detectSource, isSafeHttpUrl, SOURCE_META } from "./external-listings";

describe("isSafeHttpUrl", () => {
  it.each([
    ["https://zillow.com/x", true],
    ["http://example.com", true],
    ["javascript:alert(1)", false],
    ["data:text/html,<script>", false],
    ["file:///etc/passwd", false],
    ["ftp://example.com", false],
    ["not a url", false],
    ["", false],
  ])("%s -> %s", (input, expected) => {
    expect(isSafeHttpUrl(input)).toBe(expected);
  });
});

describe("detectSource", () => {
  it.each([
    ["https://www.zillow.com/homedetails/123", "zillow"],
    ["https://www.apartments.com/x", "apartments"],
    ["https://www.rent.com/x", "rent"],
    ["https://losangeles.craigslist.org/x", "craigslist"],
    ["https://www.facebook.com/marketplace/x", "facebook"],
    ["https://fb.com/marketplace", "facebook"],
    ["https://www.trulia.com/p/x", "trulia"],
    ["https://hotpads.com/x", "hotpads"],
    ["https://www.redfin.com/x", "redfin"],
    ["https://www.realtor.com/x", "realtor"],
    ["https://example.com/x", "other"],
    ["not-a-url", "other"],
  ])("%s -> %s", (url, expected) => {
    expect(detectSource(url)).toBe(expected);
  });
});

describe("SOURCE_META", () => {
  it("has label and color for every source", () => {
    for (const key of [
      "zillow", "apartments", "rent", "craigslist", "facebook",
      "trulia", "hotpads", "redfin", "realtor", "other",
    ] as const) {
      expect(SOURCE_META[key].label).toBeTruthy();
      expect(SOURCE_META[key].color).toMatch(/^#[0-9a-f]+$/i);
    }
  });
});

import { expiryToDate, fetchSharedImport } from "./external-listings";
import { vi, beforeEach } from "vitest";

describe("expiryToDate", () => {
  const NOW = 1_700_000_000_000;
  it("returns null for never/unknown", () => {
    expect(expiryToDate("never", NOW)).toBeNull();
    expect(expiryToDate("bogus", NOW)).toBeNull();
    expect(expiryToDate("", NOW)).toBeNull();
  });
  it.each([
    ["1h", 3600e3],
    ["24h", 24 * 3600e3],
    ["7d", 7 * 24 * 3600e3],
    ["30d", 30 * 24 * 3600e3],
  ])("%s adds %d ms", (v, ms) => {
    expect(expiryToDate(v, NOW)).toBe(new Date(NOW + ms).toISOString());
  });
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));
import { supabase } from "@/integrations/supabase/client";

describe("fetchSharedImport", () => {
  beforeEach(() => { (supabase.rpc as any).mockReset(); });

  it("returns missing for invalid uuid without hitting the network", async () => {
    const r = await fetchSharedImport("not-a-uuid");
    expect(r.status).toBe("missing");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  const VALID = "11111111-1111-1111-1111-111111111111";

  it("returns missing when rpc returns empty", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    expect((await fetchSharedImport(VALID)).status).toBe("missing");
  });

  it("returns missing on rpc error", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: "x" } });
    expect((await fetchSharedImport(VALID)).status).toBe("missing");
  });

  it("returns expired when row is flagged", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ expired: true, share_expires_at: "2025-01-01T00:00:00Z" }],
      error: null,
    });
    const r = await fetchSharedImport(VALID);
    expect(r.status).toBe("expired");
    if (r.status === "expired") expect(r.expiredAt).toBe("2025-01-01T00:00:00Z");
  });

  it("returns ok with masked listing payload", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{
        expired: false, id: "abc", source: "zillow", title: "T",
        price_monthly: 2000, bedrooms: 2, bathrooms: 1, location: "Brooklyn",
        notes: null, url: null, share_expires_at: null, share_mask_sensitive: true,
        created_at: "2026-01-01T00:00:00Z",
      }],
      error: null,
    });
    const r = await fetchSharedImport(VALID);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.listing.share_mask_sensitive).toBe(true);
      expect(r.listing.url).toBeNull();
      expect(r.listing.notes).toBeNull();
      expect(r.listing.source).toBe("zillow");
    }
  });
});
