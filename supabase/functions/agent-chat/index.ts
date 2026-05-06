import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // user-scoped client (RLS) for verifying ownership
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // admin for atomic writes
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // profile + daily limit
    const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile) return json({ error: "no_profile" }, 400);

    // reset window
    const last = new Date(profile.daily_chat_reset_at).getTime();
    let count = profile.daily_chat_count;
    if (Date.now() - last > 24 * 60 * 60 * 1000) {
      count = 0;
      await admin.from("profiles").update({ daily_chat_count: 0, daily_chat_reset_at: new Date().toISOString() }).eq("id", user.id);
    }
    if (profile.tier === "free" && count >= 5) {
      return json({ error: "daily_limit", message: "Free tier: 5 chats/day. Upgrade to Pro for unlimited." }, 429);
    }

    // conversation + agent
    const { data: conv } = await admin.from("conversations").select("*, agents(*)").eq("id", conversation_id).eq("user_id", user.id).maybeSingle();
    if (!conv) return json({ error: "conversation_not_found" }, 404);

    const { data: history } = await admin.from("messages")
      .select("role,content").eq("conversation_id", conversation_id).order("created_at").limit(20);

    // insert user message immediately
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

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "rate_limit", message: "Too many requests. Try again in a moment." }, 429);
      if (aiRes.status === 402) return json({ error: "payment_required", message: "AI credits exhausted." }, 402);
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return json({ error: "ai_error" }, 500);
    }

    // pipe stream and accumulate to save final message
    let fullText = "";
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiRes.body!.getReader();
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
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch { /* ignore */ }
            controller.enqueue(new TextEncoder().encode(line + "\n"));
          }
        }
        controller.close();

        // persist agent reply + bump counters
        await admin.from("messages").insert({ conversation_id, role: "agent", content: fullText });
        await admin.from("conversations").update({
          last_message_at: new Date().toISOString(),
          message_count: (conv.message_count || 0) + 2,
          title: conv.title || message.slice(0, 60),
        }).eq("id", conversation_id);
        if (profile.tier === "free") {
          await admin.from("profiles").update({ daily_chat_count: count + 1 }).eq("id", user.id);
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e: any) {
    console.error(e);
    return json({ error: e.message || "server_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
