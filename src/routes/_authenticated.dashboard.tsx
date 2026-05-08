import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAgentAvatar } from "@/lib/agent-avatars";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type ConvRow = {
  id: string;
  agent_id: string;
  title: string | null;
  message_count: number;
  last_message_at: string;
  agents: { name: string; avatar_emoji: string; color: string; state: string } | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const [convos, setConvos] = useState<ConvRow[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string; daily_chat_count: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }

      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("profiles").select("full_name,tier,daily_chat_count").eq("id", session.user.id).maybeSingle(),
        supabase.from("conversations")
          .select("id,agent_id,title,message_count,last_message_at,agents(name,avatar_emoji,color,state)")
          .order("last_message_at", { ascending: false }).limit(50),
      ]);
      setProfile(p as any);
      setConvos((c as any) || []);
    })();
  }, [navigate]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">// DASHBOARD</div>
          <h1 className="text-3xl font-bold">Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
        </div>
        {profile && (
          <div className="flex gap-3">
            <Stat label="Tier" value={profile.tier.toUpperCase()} />
            <Stat label="Chats today" value={String(profile.daily_chat_count)} />
            <Stat label="Conversations" value={String(convos.length)} />
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Your conversations</h2>
      {convos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No chats yet. <Link to="/map" className="text-primary underline">Meet an agent →</Link></p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {convos.map((c) => (
            <Link
              key={c.id}
              to="/agent/$state"
              params={{ state: c.agent_id.toLowerCase() }}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
                   style={{ background: `${c.agents?.color}22`, border: `1px solid ${c.agents?.color}66` }}>
                {getAgentAvatar(c.agent_id) ? (
                  <img src={getAgentAvatar(c.agent_id)} alt={c.agents?.name || ""} loading="lazy" width={48} height={48} className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl">{c.agents?.avatar_emoji}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{c.agents?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.title || `${c.message_count} messages`}</div>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {new Date(c.last_message_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2">
      <div className="font-mono text-[9px] text-muted-foreground tracking-[0.2em] uppercase">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
