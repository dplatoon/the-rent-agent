import { describe, it, expect } from "vitest";
import { agentRouteParams } from "./agents";

/**
 * The agent card on the listing detail page (src/routes/listings_.$id.tsx)
 * links to the /agent/$state route. The $state param is keyed by the
 * agent's id (e.g. "AZ"), lowercased — NOT by agent.state ("arizona"),
 * which would 404 because fetchAgent looks up by id.
 *
 * This regression test locks in that contract for multiple listings'
 * agents across different states.
 */
describe("agentRouteParams (listing detail → /agent/$state link)", () => {
  const cases = [
    { agent: { id: "AZ", state: "arizona" }, expected: "az" },
    { agent: { id: "CA", state: "california" }, expected: "ca" },
    { agent: { id: "NY", state: "new york" }, expected: "ny" },
    { agent: { id: "TX", state: "texas" }, expected: "tx" },
    { agent: { id: "fl", state: "florida" }, expected: "fl" },
  ];

  for (const { agent, expected } of cases) {
    it(`maps agent id="${agent.id}" (state="${agent.state}") → /agent/${expected}`, () => {
      const params = agentRouteParams(agent);
      expect(params).toEqual({ state: expected });
      expect(params.state).toBe(agent.id.toLowerCase());
      // Must NOT use the human-readable state name — that would break the route.
      expect(params.state).not.toBe(agent.state);
    });
  }

  it("returns only the state key (no extra params)", () => {
    expect(Object.keys(agentRouteParams({ id: "AZ" }))).toEqual(["state"]);
  });
});
