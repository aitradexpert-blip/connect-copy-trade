
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
