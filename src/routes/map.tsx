import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentMap } from "@/components/AgentMap";
import { fetchAgents } from "@/lib/agents";
import { getAgentAvatar } from "@/lib/agent-avatars";
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

      {/* Legend */}
      <section className="mt-10 rounded-2xl border border-border bg-surface/40 p-5">
        <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// LEGEND</div>
            <h2 className="font-display text-lg font-bold">How to read the map</h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Each pin's <span className="text-foreground font-medium">color</span> is its agent's signature.
            The <span className="text-foreground font-medium">city</span> shows their home market;
            the <span className="text-foreground font-medium">catchphrase</span> is their lens on it.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
              <span
                className="mt-1 inline-block w-3 h-3 rounded-full shrink-0"
                style={{ background: a.color, boxShadow: `0 0 10px ${a.color}aa` }}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-sm">{a.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">
                    {(a as any).major_city || a.state}
                  </span>
                </div>
                {(a as any).catchphrase && (
                  <p className="text-xs italic mt-0.5 leading-snug" style={{ color: a.color }}>
                    "{(a as any).catchphrase}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((a) => (
          <a
            key={a.id}
            href={`/agent/${a.id.toLowerCase()}`}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition avatar-3d-wrap"
          >
            <div className="flex items-center gap-3">
              <div className="avatar-3d w-14 h-14 rounded-xl overflow-hidden"
                   style={{ background: `${a.color}22`, border: `1px solid ${a.color}66`, boxShadow: `0 6px 18px -6px ${a.color}88` }}>
                {getAgentAvatar(a.id) ? (
                  <img src={getAgentAvatar(a.id)} alt={a.name} loading="lazy" width={56} height={56} className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl">{a.avatar_emoji}</span>
                )}
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
