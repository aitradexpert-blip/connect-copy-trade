-- Create pending_trades table for verbal trade confirmations
CREATE TABLE IF NOT EXISTS pending_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  lot_size NUMERIC(10,2),
  risk_percent NUMERIC(5,2),
  stop_loss NUMERIC(10,2),
  take_profit NUMERIC(10,2),
  awaiting_confirmation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Enable RLS
ALTER TABLE pending_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own pending trades"
ON pending_trades
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to auto-delete expired confirmations
CREATE OR REPLACE FUNCTION delete_expired_pending_trades()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM pending_trades WHERE expires_at < NOW();
END;
$$;

-- Create index for faster queries
CREATE INDEX idx_pending_trades_user_id ON pending_trades(user_id);
CREATE INDEX idx_pending_trades_expires_at ON pending_trades(expires_at);