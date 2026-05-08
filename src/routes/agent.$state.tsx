import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgent } from "@/lib/agents";
import { getAgentAvatar } from "@/lib/agent-avatars";
import { fetchListings, type Listing } from "@/lib/listings";
import { fetchRentcastListings, type RentcastListing } from "@/lib/rentcast";
import { ListingCard } from "@/components/ListingCard";
import { RentCastCard } from "@/components/RentCastCard";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, ArrowLeft } from "lucide-react";

type Agent = Database["public"]["Tables"]["agents"]["Row"];
type Msg = { role: "user" | "agent"; content: string };

export const Route = createFileRoute("/agent/$state")({
  component: AgentChat,
});

function AgentChat() {
  const { state } = Route.useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [agentListings, setAgentListings] = useState<Listing[]>([]);
  const [liveListings, setLiveListings] = useState<RentcastListing[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchListings({ agent_id: state, limit: 4 }).then(setAgentListings).catch(() => {});
    fetchRentcastListings({ agent_id: state, limit: 6 }).then(setLiveListings).catch(() => {});
  }, [state]);

  useEffect(() => {
    fetchAgent(state).then((a) => {
      if (!a) {
        toast.error("Agent not found");
        navigate({ to: "/map" });
        return;
      }
      setAgent(a);
      setMessages([{ role: "agent", content: a.greeting }]);
    });
  }, [state, navigate]);

  // auth + create/find conversation
  useEffect(() => {
    if (!agent) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthChecked(true);
      if (!session) return;
      // most recent open conversation with this agent, or create new
      const { data: existing } = await supabase
        .from("conversations").select("*")
        .eq("user_id", session.user.id).eq("agent_id", agent.id)
        .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        setConversationId(existing.id);
        const { data: msgs } = await supabase.from("messages")
          .select("role,content").eq("conversation_id", existing.id).order("created_at");
        if (msgs && msgs.length) setMessages(msgs as Msg[]);
      } else {
        const { data: created } = await supabase.from("conversations")
          .insert({ user_id: session.user.id, agent_id: agent.id }).select().single();
        if (created) setConversationId(created.id);
      }
    })();
  }, [agent]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    if (!authChecked) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to chat");
      navigate({ to: "/auth" });
      return;
    }
    if (!conversationId) {
      toast.error("Conversation not ready yet");
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }, { role: "agent", content: "" }]);
    setSending(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversation_id: conversationId, message: userMsg }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error(err.message || "Rate limited");
        else if (resp.status === 402) toast.error("AI credits exhausted. Add funds in workspace.");
        else toast.error(err.message || "Chat error");
        setMessages((m) => m.slice(0, -1));
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: "agent", content: acc };
                return next;
              });
            }
          } catch { /* incomplete */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Network error");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  if (!agent) return <div className="p-12 text-center text-muted-foreground">Loading agent…</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/map" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-3 w-3 mr-1" /> Back to map
      </Link>

      {/* Agent header */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-4 flex items-center gap-4"
           style={{ borderColor: `${agent.color}55`, boxShadow: `0 0 30px -10px ${agent.color}66` }}>
        <div className="avatar-3d-wrap shrink-0">
          <div className="avatar-3d w-20 h-20 rounded-2xl overflow-hidden"
               style={{ background: `${agent.color}22`, border: `1px solid ${agent.color}66`, boxShadow: `0 10px 30px -10px ${agent.color}88` }}>
            {getAgentAvatar(agent.id) ? (
              <img src={getAgentAvatar(agent.id)} alt={agent.name} width={80} height={80} className="w-full h-full object-cover object-top" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-4xl">{agent.avatar_emoji}</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{agent.name}</h1>
            {agent.is_online && <span className="font-mono text-[9px] text-mint">● ONLINE</span>}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
            {agent.state}{(agent as any).major_city ? ` · ${(agent as any).major_city}` : ""} · {agent.specialty}
          </div>
          {(agent as any).catchphrase && (
            <p className="text-sm italic mt-1" style={{ color: agent.color }}>
              "{(agent as any).catchphrase}"
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.bio}</p>
        </div>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="rounded-2xl border border-border bg-surface/50 h-[55vh] overflow-y-auto p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-elevated border border-border"
            }`}>
              {m.content || <span className="opacity-50">…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-3 flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={authChecked && !conversationId ? "Sign in to chat…" : `Message ${agent.name}…`}
          disabled={sending}
          className="h-12"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="h-12 bg-primary text-primary-foreground hover:bg-primary/90">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {authChecked && !conversationId && (
        <p className="mt-2 text-xs text-muted-foreground text-center">
          <Link to="/auth" className="text-primary underline">Sign in</Link> to start chatting with {agent.name}.
        </p>
      )}

      {agentListings.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// {agent.name.toUpperCase()}'S PICKS</div>
              <h2 className="font-display text-2xl font-bold">Hand-picked in {agent.state}</h2>
            </div>
            <Link to="/listings" className="text-sm text-primary hover:underline">All listings →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {agentListings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      {liveListings.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-mint mb-1">// LIVE MARKET</div>
              <h2 className="font-display text-2xl font-bold">Fresh on the market in {agent.state}</h2>
              <p className="text-xs text-muted-foreground mt-1">Powered by RentCast · updated daily</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveListings.map((l) => <RentCastCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}
    </main>
  );
}
