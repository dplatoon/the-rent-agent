
CREATE POLICY "users update own saved"
ON public.saved_listings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
