import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentMap } from "@/components/AgentMap";
import { ListingCard } from "@/components/ListingCard";
import { fetchAgents } from "@/lib/agents";
import { fetchListings, type Listing } from "@/lib/listings";
import { getAgentAvatar } from "@/lib/agent-avatars";
import type { Database } from "@/integrations/supabase/types";
import { ArrowRight, Sparkles, Zap, Shield } from "lucide-react";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RentAgent.io — 50 AI Rental Agents, One Search" },
      { name: "description", content: "Skip the listing scroll. Chat with hand-crafted AI rental agents who know every state inside out." },
      { property: "og:title", content: "RentAgent.io — AI rental intelligence" },
      { property: "og:description", content: "Hand-curated rentals, conversational discovery, zero scams." },
    ],
  }),
  component: Index,
});

function Index() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [featured, setFeatured] = useState<Listing[]>([]);

  useEffect(() => {
    fetchAgents().then(setAgents).catch(console.error);
    fetchListings({ featured: true, limit: 6 }).then(setFeatured).catch(console.error);
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 pb-24">
      {/* MAGAZINE HERO */}
      <section className="pt-12 md:pt-16 pb-10 grid lg:grid-cols-12 gap-8 items-end animate-fade-up">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
            ISSUE 01 · {agents.length || 12} AGENTS LIVE · SPRING 2026
          </div>
          <h1 className="font-display text-[clamp(2.8rem,7vw,5.6rem)] font-extrabold tracking-[-0.03em] leading-[0.95]">
            The rental search,<br />
            <span className="text-gradient italic font-medium">reimagined</span> as a<br />
            conversation.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Fifty hand-crafted AI agents. One for every state. They know the streets, the prices, and the difference between a deal and a trap.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/listings">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan h-12 px-6">
                Browse listings <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/map">
              <Button size="lg" variant="outline" className="h-12 px-6">Meet the agents</Button>
            </Link>
          </div>
        </div>

        <aside className="lg:col-span-5 space-y-3">
          {agents.slice(0, 3).map((a, i) => (
            <Link
              key={a.id}
              to="/agent/$state"
              params={{ state: a.id.toLowerCase() }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 backdrop-blur p-4 transition hover:border-primary/40 hover:translate-x-1"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="avatar-3d-wrap">
                <div className="avatar-3d w-14 h-14 rounded-xl overflow-hidden shrink-0"
                     style={{ background: `${a.color}22`, border: `1px solid ${a.color}66`, boxShadow: `0 8px 24px -8px ${a.color}88` }}>
                  {getAgentAvatar(a.id) ? (
                    <img src={getAgentAvatar(a.id)} alt={a.name} loading="lazy" width={56} height={56} className="w-full h-full object-cover object-top" />
                  ) : <span className="w-full h-full flex items-center justify-center text-2xl">{a.avatar_emoji}</span>}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{a.state}</div>
                <div className="font-display font-bold text-lg leading-tight">{a.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{a.specialty}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </aside>
      </section>

      <div className="editorial-rule my-8" />

      {/* MAP */}
      <section className="py-4">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// THE MAP</div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">Coast to coast.</h2>
          </div>
          <Link to="/map" className="text-sm text-primary hover:underline inline-flex items-center gap-1">View full map <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <AgentMap agents={agents} compact />
      </section>

      <div className="editorial-rule my-12" />

      {/* FEATURED LISTINGS — magazine grid */}
      <section className="py-4">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// THIS WEEK</div>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">Featured rentals.</h2>
          </div>
          <Link to="/listings" className="text-sm text-primary hover:underline inline-flex items-center gap-1">All listings <ArrowRight className="h-3 w-3" /></Link>
        </div>

        {featured.length > 0 && (
          <div className="grid lg:grid-cols-12 gap-5">
            {/* Hero card */}
            <div className="lg:col-span-7">
              <ListingCard listing={featured[0]} />
            </div>
            <div className="lg:col-span-5 grid sm:grid-cols-2 lg:grid-cols-1 gap-5">
              {featured.slice(1, 3).map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
            {featured.slice(3, 6).map((l) => (
              <div key={l.id} className="lg:col-span-4"><ListingCard listing={l} /></div>
            ))}
          </div>
        )}
      </section>

      <div className="editorial-rule my-12" />

      {/* ROSTER */}
      <section className="py-4">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// THE ROSTER</div>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">Twelve states. Twelve personalities.</h2>
          </div>
          <Link to="/map" className="hidden md:inline-flex items-center gap-2 text-sm text-primary hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.slice(0, 6).map((a) => (
            <Link
              key={a.id}
              to="/agent/$state"
              params={{ state: a.id.toLowerCase() }}
              className="group relative rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="avatar-3d-wrap">
                  <div className="avatar-3d w-16 h-16 rounded-2xl overflow-hidden shrink-0"
                       style={{ background: `${a.color}22`, border: `1px solid ${a.color}66`, boxShadow: `0 8px 24px -8px ${a.color}88` }}>
                    {getAgentAvatar(a.id) ? (
                      <img src={getAgentAvatar(a.id)} alt={a.name} loading="lazy" width={64} height={64} className="w-full h-full object-cover object-top" />
                    ) : <span className="w-full h-full flex items-center justify-center text-3xl">{a.avatar_emoji}</span>}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold truncate">{a.name}</h3>
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

      <div className="editorial-rule my-12" />

      {/* Value props */}
      <section className="py-4 grid md:grid-cols-3 gap-6">
        {[
          { icon: Sparkles, title: "Zero scams", body: "Verified market data. No Craigslist roulette." },
          { icon: Zap, title: "Real conversation", body: "Tell an agent your vibe — get places, not 600 thumbnails." },
          { icon: Shield, title: "Local intelligence", body: "Each agent knows their state's neighborhoods cold." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
            <f.icon className="h-6 w-6 text-primary mb-4" />
            <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mt-16 py-16 text-center rounded-3xl border border-border bg-gradient-to-br from-surface to-elevated px-8">
        <h2 className="font-display text-3xl md:text-5xl font-extrabold max-w-3xl mx-auto tracking-tight">Your next apartment is one conversation away.</h2>
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
