import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentMap } from "@/components/AgentMap";
import { fetchAgents } from "@/lib/agents";
import { getAgentAvatar } from "@/lib/agent-avatars";
import type { Database } from "@/integrations/supabase/types";
import { ArrowRight, Sparkles, Zap, Shield } from "lucide-react";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    fetchAgents().then(setAgents).catch(console.error);
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 pb-24">
      {/* Hero */}
      <section className="pt-16 md:pt-24 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
          {agents.length || 12} AGENTS LIVE · 50 STATES SOON
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
          50 AI Agents.<br />
          50 States.<br />
          <span className="text-gradient">One rental search.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          Skip the Zillow scroll-of-doom. Meet a hand-crafted AI rental agent for every state — they know the neighborhoods, the prices, and your taste.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/map">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan h-12 px-6">
              Explore the map <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="h-12 px-6">Get free access</Button>
          </Link>
        </div>
      </section>

      {/* Map preview */}
      <section className="py-8">
        <AgentMap agents={agents} />
      </section>

      {/* Featured agents */}
      <section className="py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// MEET THE ROSTER</div>
            <h2 className="text-3xl md:text-4xl font-bold">Twelve states. Twelve personalities.</h2>
          </div>
          <Link to="/map" className="hidden md:inline-flex items-center gap-2 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.slice(0, 6).map((a) => (
            <Link
              key={a.id}
              to="/agent/$state"
              params={{ state: a.id.toLowerCase() }}
              className="group relative rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: `${a.color}22`, border: `1px solid ${a.color}66` }}
                >
                  {a.avatar_emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold truncate">{a.name}</h3>
                    {a.is_online && <span className="font-mono text-[9px] text-mint">● ONLINE</span>}
                  </div>
                  <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{a.state}</div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.bio}</p>
                  <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono"
                       style={{ background: `${a.color}22`, color: a.color }}>
                    {a.specialty}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: Sparkles, title: "Zero scams", body: "Listings come from verified market data, not Craigslist roulette." },
          { icon: Zap, title: "Real conversation", body: "Tell an agent your vibe — they'll surface the right places, not 600 thumbnails." },
          { icon: Shield, title: "Local intelligence", body: "Each agent knows their state's neighborhoods, commutes, and landlord reps." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="h-6 w-6 text-primary mb-4" />
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="py-16 text-center rounded-3xl border border-border bg-gradient-to-br from-surface to-elevated px-8">
        <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">Your next apartment is one conversation away.</h2>
        <p className="mt-4 text-muted-foreground">Free to start. 5 chats a day. No credit card.</p>
        <Link to="/auth">
          <Button size="lg" className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan h-12 px-8">
            Start chatting free
          </Button>
        </Link>
      </section>
    </main>
  );
}
