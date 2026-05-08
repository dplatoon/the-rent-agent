import { Link } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { getAgentAvatar } from "@/lib/agent-avatars";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

export function AgentMap({ agents, compact = false }: { agents: Agent[]; compact?: boolean }) {
  return (
    <div className={`relative w-full ${compact ? "aspect-[2/1]" : "aspect-[16/9]"} rounded-2xl border border-border bg-surface/40 bg-grid overflow-hidden`}>
      {/* Decorative US silhouette via radial gradients */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
           style={{ background: "radial-gradient(ellipse 70% 55% at 50% 55%, oklch(0.22 0.05 254) 0%, transparent 70%)" }} />
      <div className="absolute top-4 left-4 font-mono text-[10px] text-muted-foreground tracking-[0.25em]">
        UNITED STATES // {agents.length} AGENTS ONLINE
      </div>

      {agents.map((a) => (
        <Link
          key={a.id}
          to="/agent/$state"
          params={{ state: a.id.toLowerCase() }}
          className="absolute group"
          style={{ left: `${a.map_x}%`, top: `${a.map_y}%`, transform: "translate(-50%,-50%)" }}
        >
          <div className="relative avatar-3d-wrap">
            <div
              className="avatar-3d avatar-float w-14 h-14 rounded-full overflow-hidden border-2 group-hover:-translate-y-1"
              style={{
                background: `${a.color}22`,
                borderColor: a.color,
                boxShadow: `0 0 24px ${a.color}88, inset 0 -4px 10px ${a.color}44`,
              }}
            >
              {getAgentAvatar(a.id) ? (
                <img
                  src={getAgentAvatar(a.id)}
                  alt={a.name}
                  loading="lazy"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">{a.avatar_emoji}</span>
              )}
            </div>
            {a.is_online && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-mint border-2 border-background animate-pulse" />
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
              <div className="bg-elevated border border-border rounded-lg px-3 py-2 shadow-xl max-w-[220px]">
                <div className="font-bold text-sm whitespace-nowrap">{a.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {a.state}{(a as any).major_city ? ` · ${(a as any).major_city}` : ""} · {a.specialty}
                </div>
                {(a as any).catchphrase && (
                  <div className="text-[11px] italic text-foreground/80 mt-1 leading-snug">
                    "{(a as any).catchphrase}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
