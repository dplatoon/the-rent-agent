
DROP POLICY IF EXISTS "users insert own messages" ON public.messages;
CREATE POLICY "users insert own messages"
ON public.messages FOR INSERT
WITH CHECK (
  role = 'user'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "no update messages"
ON public.messages FOR UPDATE TO anon, authenticated
USING (false);

CREATE POLICY "no delete messages"
ON public.messages FOR DELETE TO anon, authenticated
USING (false);

CREATE POLICY "no update pwa_events"
ON public.pwa_events FOR UPDATE TO anon, authenticated
USING (false);

CREATE POLICY "no delete pwa_events"
ON public.pwa_events FOR DELETE TO anon, authenticated
USING (false);

REVOKE EXECUTE ON FUNCTION public.consume_daily_chat(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_chat(uuid, integer) TO service_role;
