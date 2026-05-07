import { test, expect } from "@playwright/test";

/**
 * E2E regression for the agent card on the listing detail page.
 *
 * For each seeded listing, we:
 *   1. open /listings/<id> directly,
 *   2. wait for the agent card link to render,
 *   3. assert its href is /agent/<agentId-lowercased> (NOT /agent/<state-name>),
 *   4. click it, and
 *   5. confirm the /agent/$state page loads — no 404, no redirect to /map
 *      (the AgentChat redirect target when fetchAgent returns nothing).
 */
const LISTINGS: { id: string; expectedState: string }[] = [
  { id: "544530e5-f8dc-4241-abbd-78c8ce464c3a", expectedState: "az" },
  { id: "1e2aef67-254a-4598-86e5-2af2d4b3854f", expectedState: "ca" },
  { id: "57d8bd6e-fdfd-4640-b2a9-5cb41731dbd5", expectedState: "co" },
  { id: "1699a7f0-a7c3-417c-8d79-00aca65b244a", expectedState: "fl" },
  { id: "03b29718-06bb-4657-a7af-8165c45ee4e6", expectedState: "ga" },
  { id: "801547d9-b280-47f2-b343-6ffb38cc67d6", expectedState: "il" },
];

for (const { id, expectedState } of LISTINGS) {
  test(`agent card on listing ${id} navigates to /agent/${expectedState}`, async ({
    page,
  }) => {
    // Track document responses for /agent/* — none of them may be a 4xx/5xx.
    const agentResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      try {
        const url = new URL(res.url());
        if (
          url.pathname.startsWith("/agent/") &&
          res.request().resourceType() === "document"
        ) {
          agentResponses.push({ url: res.url(), status: res.status() });
        }
      } catch {
        /* ignore */
      }
    });

    // Navigate via the listings index → click the card. This avoids
    // depending on the exact file name of the listing detail route
    // (listings_.$id vs listings.$id), which differs between deployments.
    await page.goto("/listings", { waitUntil: "domcontentloaded" });

    const listingCard = page.locator(`a[href^="/listings/${id}"]`).first();
    await expect(listingCard).toBeVisible({ timeout: 20_000 });
    await listingCard.click();

    await page.waitForURL(`**/listings/${id}**`, { timeout: 15_000 });

    // The agent card is rendered after fetchAgent() resolves on the detail
    // page. Wait for the <Link to="/agent/$state"> to appear.
    const agentLink = page.locator('a[href^="/agent/"]').first();
    await expect(agentLink).toBeVisible({ timeout: 20_000 });

    const href = await agentLink.getAttribute("href");
    expect(href).toBe(`/agent/${expectedState}`);

    await agentLink.click();

    // Must land on /agent/<state> — must NOT bounce to /map (the redirect
    // target when fetchAgent returns nothing) and must NOT 404.
    await page.waitForURL(`**/agent/${expectedState}`, { timeout: 15_000 });
    expect(page.url()).toContain(`/agent/${expectedState}`);
    expect(page.url()).not.toMatch(/\/map(\?|$)/);

    for (const res of agentResponses) {
      expect(
        res.status,
        `expected /agent/* document load to be ok, got ${res.status} for ${res.url}`,
      ).toBeLessThan(400);
    }

    // The agent chat page renders the "Back" link (to /map) once mounted.
    await expect(page.getByText(/back/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
}
