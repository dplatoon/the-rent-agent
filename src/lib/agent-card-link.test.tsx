// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { agentRouteParams } from "./agents";

/**
 * Integration test for the agent card link rendered on the listing detail
 * page (src/routes/listings_.$id.tsx). It must navigate to /agent/$state
 * with the agent's id (lowercased), NOT the human-readable state name.
 *
 * We mount a minimal router that mirrors the link contract used by the
 * real listing detail page, then click the rendered card.
 */
function renderWithRouter(agent: { id: string; state: string; name: string }) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const listingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/listings_/$id",
    component: () => (
      <Link
        to="/agent/$state"
        params={agentRouteParams(agent)}
        data-testid="agent-card"
      >
        {agent.name}
      </Link>
    ),
  });

  const agentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/agent/$state",
    component: function AgentPage() {
      const { state } = agentRoute.useParams();
      return <div data-testid="agent-page">agent:{state}</div>;
    },
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([listingRoute, agentRoute]),
    history: createMemoryHistory({ initialEntries: ["/listings_/abc-123"] }),
  });

  return { router, ...render(<RouterProvider router={router} />) };
}

describe("agent card link on listing detail page", () => {
  afterEach(() => cleanup());

  const cases = [
    { id: "AZ", state: "arizona", expected: "az" },
    { id: "CA", state: "california", expected: "ca" },
    { id: "NY", state: "new york", expected: "ny" },
  ];

  for (const { id, state, expected } of cases) {
    it(`navigates to /agent/${expected} for agent id="${id}"`, async () => {
      const user = userEvent.setup();
      const { router } = renderWithRouter({ id, state, name: `${state} agent` });

      const card = await screen.findByTestId("agent-card");
      expect(card.getAttribute("href")).toBe(`/agent/${expected}`);

      await user.click(card);

      await screen.findByTestId("agent-page");
      expect(router.state.location.pathname).toBe(`/agent/${expected}`);
      // The route param key must equal the agent id (lowercased), not the state name.
      expect(router.state.location.pathname).not.toBe(`/agent/${state}`);
    });
  }
});
