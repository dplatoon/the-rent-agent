import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentMap } from "@/components/AgentMap";
import { fetchAgents } from "@/lib/agents";
import type { Database } from "@/integrations/supabase/types";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "The Agent Map — RentAgent.io" },
      { name: "description", content: "Pick your state. Meet your AI rental agent." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => { fetchAgents().then(setAgents); }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// THE ROSTER</div>
      <h1 className="text-4xl md:text-5xl font-bold mb-2">Pick a state. Meet your agent.</h1>
      <p className="text-muted-foreground mb-8 max-w-xl">
        Tap any pin to start chatting. Each agent is tuned to their state — slang, neighborhoods, market quirks, and all.
      </p>

      <AgentMap agents={agents} />

      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((a) => (
          <a
            key={a.id}
            href={`/agent/${a.id.toLowerCase()}`}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                   style={{ background: `${a.color}22`, border: `1px solid ${a.color}66` }}>
                {a.avatar_emoji}
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">{a.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">{a.state}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground line-clamp-2">{a.specialty}</div>
          </a>
        ))}
      </div>
    </main>
  );
}
