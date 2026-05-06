CREATE POLICY "no one can read pwa events"
ON public.pwa_events
FOR SELECT
USING (false);