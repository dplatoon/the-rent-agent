import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

// Origin allowlist (extend via ALLOWED_ORIGINS env, comma-separated)
const DEFAULT_ALLOWED = [
  "https://the-rent-agent.lovable.app",
  "https://id-preview--0632b21f-b411-4099-aa84-6a2ca5449ebe.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const EXTRA = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED, ...EXTRA]);

function corsFor(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin))
    ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const PayloadSchema = z.object({
  conversation_id: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

const FREE_DAILY_LIMIT = 5;

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsFor(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!cors["Access-Control-Allow-Origin"]) {
    return json({ error: "forbidden" }, 403, cors);
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing");
      return json({ error: "server_error" }, 500, cors);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, cors);

    // Parse + validate input
    let raw: unknown;
    try { raw = await req.json(); } catch { return json({ error: "invalid_request" }, 400, cors); }
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_request" }, 400, cors);
    const { conversation_id, message } = parsed.data;

    // Verify user via user-scoped client
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401, cors);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try atomic RPC first; fall back to atomic UPDATE on missing function
    let allowed = false;
    let tier = "free";
    {
      const { data: rpcData, error: rpcErr } = await admin.rpc("consume_daily_chat", {
        _user_id: user.id, _limit: FREE_DAILY_LIMIT,
      });
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length) {
        allowed = !!rpcData[0].allowed;
        tier = rpcData[0].tier || "free";
      } else {
        // Fallback: reset stale window, then optimistic-concurrency increment
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await admin.from("profiles")
          .update({ daily_chat_count: 0, daily_chat_reset_at: new Date().toISOString() })
          .eq("id", user.id)
          .lt("daily_chat_reset_at", dayAgo);

        const { data: prof } = await admin.from("profiles")
          .select("tier, daily_chat_count").eq("id", user.id).maybeSingle();
        if (!prof) return json({ error: "no_profile" }, 400, cors);
        tier = prof.tier || "free";

        if (tier !== "free") {
          allowed = true;
        } else {
          const cnt = prof.daily_chat_count ?? 0;
          if (cnt >= FREE_DAILY_LIMIT) {
            allowed = false;
          } else {
            // Conditional update — fails (zero rows) if another request raced ahead
            const { data: rows, error: bumpErr } = await admin.from("profiles")
              .update({ daily_chat_count: cnt + 1 })
              .eq("id", user.id)
              .eq("daily_chat_count", cnt)
              .select("id");
            allowed = !bumpErr && !!rows && rows.length > 0;
          }
        }
      }
    }

    if (!allowed) {
      return json({ error: "daily_limit", message: "Free tier: 5 chats/day. Upgrade to Pro for unlimited." }, 429, cors);
    }

    // Conversation + agent (scoped to user)
    const { data: conv } = await admin.from("conversations")
      .select("*, agents(*)").eq("id", conversation_id).eq("user_id", user.id).maybeSingle();
    if (!conv) return json({ error: "not_found" }, 404, cors);

    const { data: history } = await admin.from("messages")
      .select("role,content").eq("conversation_id", conversation_id).order("created_at").limit(20);

    await admin.from("messages").insert({ conversation_id, role: "user", content: message });

    const agent = (conv as any).agents;
    const systemPrompt = `You are ${agent.name}, an elite AI rental specialist for ${agent.state}, USA.

IDENTITY: You ARE ${agent.name}. Never break character. Never say you are an AI or language model.
Specialty: ${agent.specialty}.
Personality: ${(agent.personality_traits || []).join(", ")}.

STYLE:
- Conversational, warm, like texting a knowledgeable local friend.
- 2-4 sentences per reply unless asked for detail.
- One emoji max per reply.
- Always end with a question or next step.
- Reference specific neighborhoods, freeways, or local landmarks in ${agent.state}.

RULES:
- If user asks about a different state, redirect them politely to that state's agent.
- Never fabricate specific listings, prices, or addresses; speak in ranges and neighborhood patterns instead.
- For free-tier users, after a few exchanges naturally mention Pro tier (unlimited chats, saved searches).
- Avoid politics, religion, controversy.
- If user mentions distress (eviction, abuse, emergency), pivot to empathy and suggest 211.org.

Begin in character.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content })),
      { role: "user", content: message },
    ];

    // Provider strategy: Anthropic primary, Lovable AI Gateway fallback.
    // Both branches must emit OpenAI-compatible SSE chunks so the existing client parser keeps working.
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const encoder = new TextEncoder();

    async function callAnthropic(): Promise<Response | null> {
      if (!ANTHROPIC_API_KEY) return null;
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            system: systemPrompt,
            stream: true,
            messages: aiMessages.filter((m) => m.role !== "system"),
          }),
        });
        if (!r.ok) {
          console.error("anthropic error", r.status, await r.text().catch(() => ""));
          return null;
        }
        return r;
      } catch (e) {
        console.error("anthropic fetch failed", e);
        return null;
      }
    }

    async function callLovable(): Promise<Response> {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: aiMessages, stream: true }),
      });
    }

    let provider: "anthropic" | "lovable" = "anthropic";
    let aiRes: Response | null = await callAnthropic();
    if (!aiRes) {
      provider = "lovable";
      aiRes = await callLovable();
    }

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "rate_limit" }, 429, cors);
      if (aiRes.status === 402) return json({ error: "payment_required" }, 402, cors);
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return json({ error: "server_error" }, 500, cors);
    }

    let fullText = "";
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiRes!.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
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
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (provider === "anthropic") {
                // Translate Anthropic events -> OpenAI-compatible chunk for the client.
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  const delta = parsed.delta.text as string;
                  fullText += delta;
                  const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n`;
                  controller.enqueue(encoder.encode(chunk));
                }
                continue;
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch { /* ignore */ }
            if (provider === "lovable") controller.enqueue(encoder.encode(line + "\n"));
          }
        }
        controller.close();

        await admin.from("messages").insert({ conversation_id, role: "agent", content: fullText });
        await admin.from("conversations").update({

          last_message_at: new Date().toISOString(),
          message_count: (conv.message_count || 0) + 2,
          title: conv.title || message.slice(0, 60),
        }).eq("id", conversation_id);
      },
    });

    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("agent-chat error", e);
    return json({ error: "server_error" }, 500, cors);
  }
});

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
