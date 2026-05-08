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
