import { test, expect } from "@playwright/test";

/**
 * E2E regression: opens multiple listing detail pages, clicks the agent
 * card, and verifies the resulting /agent/$state page loads successfully
 * (not a 404, not a redirect away due to "Agent not found").
 *
 * One listing per agent state, picked from seeded data.
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
  test(`agent card on listing ${id} navigates to /agent/${expectedState}`, async ({ page }) => {
    // Track navigation responses for the agent route to assert no 404.
    const agentResponses: number[] = [];
    page.on("response", (res) => {
      const url = new URL(res.url());
      if (
        url.pathname.startsWith("/agent/") &&
        res.request().resourceType() === "document"
      ) {
        agentResponses.push(res.status());
      }
    });

    await page.goto(`/listings/${id}`, { waitUntil: "domcontentloaded" });

    // The agent card is an <a href="/agent/<state>"> rendered after the
    // agent loads. Wait for it, capture the href, then click.
    const agentLink = page.locator('a[href^="/agent/"]').first();
    await expect(agentLink).toBeVisible({ timeout: 15_000 });

    const href = await agentLink.getAttribute("href");
    expect(href).toBe(`/agent/${expectedState}`);

    await agentLink.click();

    // Must land on /agent/<state> — never bounced to /map (the redirect
    // target when fetchAgent returns nothing) and never a 404 page.
    await page.waitForURL(`**/agent/${expectedState}`, { timeout: 15_000 });
    expect(page.url()).toContain(`/agent/${expectedState}`);
    expect(page.url()).not.toContain("/map");

    // No document-level 404 for any /agent/* navigation in this test.
    for (const status of agentResponses) {
      expect(status).toBeLessThan(400);
    }

    // Sanity: the agent chat page renders something (back link is stable).
    await expect(page.getByText(/back/i).first()).toBeVisible({ timeout: 10_000 });
  });
}
