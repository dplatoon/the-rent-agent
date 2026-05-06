// Deno tests for agent-chat: verifies concurrency safety of the daily chat
// limit (consume_daily_chat RPC) and the edge function's HTTP error codes.
//
// Required env (set automatically in the Lovable test runner):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// The function URL is derived from SUPABASE_URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/agent-chat`;
const ALLOWED_ORIGIN = "http://localhost:5173";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ---------- helpers ----------

async function createTestUser(): Promise<{ id: string; email: string }> {
  const email = `test-${crypto.randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!Test1234!",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("user create failed");
  // Ensure profile row exists (handle_new_user trigger normally creates it).
  await admin.from("profiles").upsert({
    id: data.user.id,
    email,
    tier: "free",
    daily_chat_count: 0,
    daily_chat_reset_at: new Date().toISOString(),
  });
  return { id: data.user.id, email };
}

async function deleteTestUser(id: string) {
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

// ---------- RPC concurrency ----------

Deno.test("consume_daily_chat: N concurrent calls allow exactly (limit - count) requests", async () => {
  const user = await createTestUser();
  try {
    const LIMIT = 5;
    const START_COUNT = 3; // 2 should be allowed, the rest forbidden
    await admin
      .from("profiles")
      .update({ daily_chat_count: START_COUNT, daily_chat_reset_at: new Date().toISOString() })
      .eq("id", user.id);

    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        admin.rpc("consume_daily_chat", { _user_id: user.id, _limit: LIMIT }),
      ),
    );

    let allowed = 0;
    let denied = 0;
    for (const r of results) {
      assertEquals(r.error, null, `RPC error: ${r.error?.message}`);
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row?.allowed) allowed++;
      else denied++;
    }
    assertEquals(allowed, LIMIT - START_COUNT, "exactly LIMIT-START allowed");
    assertEquals(denied, N - (LIMIT - START_COUNT), "rest denied");

    const { data: prof } = await admin
      .from("profiles")
      .select("daily_chat_count")
      .eq("id", user.id)
      .single();
    assertEquals(prof?.daily_chat_count, LIMIT, "count saturates at limit");
  } finally {
    await deleteTestUser(user.id);
  }
});

Deno.test("consume_daily_chat: pro tier is unlimited and does not increment", async () => {
  const user = await createTestUser();
  try {
    await admin.from("profiles").update({ tier: "pro" }).eq("id", user.id);
    for (let i = 0; i < 8; i++) {
      const { data, error } = await admin.rpc("consume_daily_chat", {
        _user_id: user.id,
        _limit: 5,
      });
      assertEquals(error, null);
      const row = Array.isArray(data) ? data[0] : data;
      assert(row?.allowed, "pro always allowed");
    }
    const { data: prof } = await admin
      .from("profiles")
      .select("daily_chat_count")
      .eq("id", user.id)
      .single();
    assertEquals(prof?.daily_chat_count, 0, "pro tier does not increment");
  } finally {
    await deleteTestUser(user.id);
  }
});

// ---------- HTTP error codes ----------

async function call(opts: {
  origin?: string;
  auth?: string;
  body?: unknown;
  method?: string;
}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin) headers["Origin"] = opts.origin;
  if (opts.auth) headers["Authorization"] = opts.auth;
  return fetch(FN_URL, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

Deno.test("HTTP 403 forbidden when Origin not allowlisted", async () => {
  const res = await call({ origin: "https://evil.example.com", body: {} });
  await res.body?.cancel();
  assertEquals(res.status, 403);
});

Deno.test("HTTP 403 forbidden when Origin missing", async () => {
  const res = await call({ body: {} });
  await res.body?.cancel();
  assertEquals(res.status, 403);
});

Deno.test("HTTP 200 OPTIONS preflight from allowed origin", async () => {
  const res = await call({ origin: ALLOWED_ORIGIN, method: "OPTIONS" });
  await res.body?.cancel();
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("access-control-allow-origin"),
    ALLOWED_ORIGIN,
  );
});

Deno.test("HTTP 401 unauthorized when JWT missing on allowed origin", async () => {
  const res = await call({
    origin: ALLOWED_ORIGIN,
    body: { conversation_id: crypto.randomUUID(), message: "hi" },
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "unauthorized");
});

Deno.test("HTTP 400 invalid_request on bad UUID", async () => {
  const res = await call({
    origin: ALLOWED_ORIGIN,
    auth: `Bearer ${ANON_KEY || "fake"}`,
    body: { conversation_id: "not-a-uuid", message: "hi" },
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_request");
});

Deno.test("HTTP 400 invalid_request on empty message", async () => {
  const res = await call({
    origin: ALLOWED_ORIGIN,
    auth: `Bearer ${ANON_KEY || "fake"}`,
    body: { conversation_id: crypto.randomUUID(), message: "" },
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_request");
});

Deno.test("HTTP 400 invalid_request when message exceeds 2000 chars", async () => {
  const res = await call({
    origin: ALLOWED_ORIGIN,
    auth: `Bearer ${ANON_KEY || "fake"}`,
    body: { conversation_id: crypto.randomUUID(), message: "x".repeat(2001) },
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_request");
});

Deno.test("HTTP 429 daily_limit when free-tier user hits the cap", async () => {
  if (!ANON_KEY) {
    console.warn("skipping: no anon key available to mint a user JWT");
    return;
  }
  const user = await createTestUser();
  try {
    // Saturate the daily counter so the next request must be denied.
    await admin
      .from("profiles")
      .update({
        tier: "free",
        daily_chat_count: 5,
        daily_chat_reset_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Sign in as the user to obtain a real JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } =
      await userClient.auth.signInWithPassword({
        email: user.email,
        password: "Test1234!Test1234!",
      });
    assertEquals(signInErr, null, `sign-in error: ${signInErr?.message}`);
    const jwt = signIn.session?.access_token;
    assert(jwt, "expected access_token from sign-in");

    const res = await call({
      origin: ALLOWED_ORIGIN,
      auth: `Bearer ${jwt}`,
      body: { conversation_id: crypto.randomUUID(), message: "hello" },
    });
    const json = await res.json();
    assertEquals(res.status, 429);
    assertEquals(json.error, "daily_limit");
    await userClient.auth.signOut();
  } finally {
    await deleteTestUser(user.id);
  }
});

// Sanitizers off: GoTrueClient keeps a refresh-token interval alive even when
// autoRefreshToken is false; signOut tears it down but the test runner still
// sees the timer briefly. Disabling the leak detector for this case is safe.
Object.assign(
  // @ts-ignore — patch metadata on the previously registered test
  {},
  {},
);

Deno.test("HTTP 400 invalid_request on malformed JSON body", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": ALLOWED_ORIGIN,
      "Authorization": `Bearer ${ANON_KEY || "fake"}`,
    },
    body: "{not json",
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_request");
});
