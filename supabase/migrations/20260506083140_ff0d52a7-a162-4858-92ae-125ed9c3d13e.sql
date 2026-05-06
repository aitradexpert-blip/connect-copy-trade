
-- 1. Unique constraint on mentor_profiles.user_id (one profile per user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mentor_profiles_user_id_key'
  ) THEN
    -- Clean any duplicates first (keep oldest)
    DELETE FROM public.mentor_profiles a USING public.mentor_profiles b
      WHERE a.user_id = b.user_id AND a.created_at > b.created_at;
    ALTER TABLE public.mentor_profiles
      ADD CONSTRAINT mentor_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2. Re-attach link_default_mentor trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_link_default_mentor ON auth.users;
CREATE TRIGGER on_auth_user_created_link_default_mentor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_default_mentor();

-- Also ensure handle_new_user trigger is attached (creates profile row)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill missing mentor_clients for direct sign-ups
DO $$
DECLARE
  v_default_slug text;
  v_mentor_id uuid;
BEGIN
  SELECT value INTO v_default_slug FROM app_settings WHERE key = 'default_mentor_slug';
  IF v_default_slug IS NULL THEN RETURN; END IF;
  SELECT id INTO v_mentor_id FROM mentor_profiles
    WHERE referral_slug = v_default_slug AND is_active = true LIMIT 1;
  IF v_mentor_id IS NULL THEN RETURN; END IF;

  INSERT INTO mentor_clients (mentor_id, client_user_id, referral_slug_used)
  SELECT v_mentor_id, p.user_id, v_default_slug
    FROM profiles p
    WHERE NOT EXISTS (SELECT 1 FROM mentor_clients mc WHERE mc.client_user_id = p.user_id);
END $$;

-- 4. Fix notification trigger link paths to match actual React routes
CREATE OR REPLACE FUNCTION public.notify_trade_executed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.signal_id IS NOT NULL THEN 'COPY_TRADE_EXECUTED' ELSE 'AI_BOT_TRADE' END,
    'Trade executed',
    NEW.symbol || ' ' || upper(NEW.direction) || ' ' || NEW.volume || ' lots',
    jsonb_build_object('trade_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'volume', NEW.volume, 'link', '/journal')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_signal()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mentor_user_id uuid;
  v_brand text;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  IF NEW.mentor_id IS NOT NULL THEN
    SELECT user_id, brand_name INTO v_mentor_user_id, v_brand
      FROM mentor_profiles WHERE id = NEW.mentor_id;

    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT mc.client_user_id,
           'NEW_IDEA_PUBLISHED',
           COALESCE(v_brand, 'Mentor') || ' published a new idea',
           NEW.symbol || ' ' || upper(NEW.direction) || ' @ ' || COALESCE(NEW.lot_size::text, '0.01') || ' lots',
           jsonb_build_object('signal_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'link', '/ideas?signal=' || NEW.id)
      FROM mentor_clients mc
     WHERE mc.mentor_id = NEW.mentor_id;
  ELSE
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT p.user_id,
           'NEW_IDEA_PUBLISHED',
           'New trade idea published',
           NEW.symbol || ' ' || upper(NEW.direction),
           jsonb_build_object('signal_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'link', '/ideas?signal=' || NEW.id)
      FROM profiles p;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_bot_assignment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_bot text; v_sym text; v_dir text;
BEGIN
  SELECT bot_name INTO v_bot FROM ai_bots WHERE id = NEW.bot_id;
  SELECT symbol, direction INTO v_sym, v_dir FROM trading_signals WHERE id = NEW.signal_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'AI_BOT_TRADE',
    COALESCE(v_bot, 'AI Bot') || ' has a new signal',
    COALESCE(v_sym, 'Signal') || ' ' || upper(COALESCE(v_dir, '')),
    jsonb_build_object('assignment_id', NEW.id, 'signal_id', NEW.signal_id, 'link', '/ai-trading')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_account_connected()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.connection_status = 'connected'
     AND (TG_OP = 'INSERT' OR OLD.connection_status IS DISTINCT FROM 'connected') THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'ACCOUNT_CONNECTED',
      'Trading account connected',
      COALESCE(NEW.name, 'Account') || ' (' || COALESCE(NEW.platform, '') || ') is ready.',
      jsonb_build_object('account_id', NEW.id, 'link', '/accounts')
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Populate training_content with curated, verified YouTube links
-- Clear existing rows that have no real URL to avoid stale entries
DELETE FROM public.training_content WHERE url IS NULL OR url = '';

INSERT INTO public.training_content (title, description, type, difficulty, category, url, content_text, tags, order_index) VALUES
-- BEGINNER
('Forex Trading for Beginners (Full Course)', 'Complete intro to currency markets, pips, lots, leverage, and execution.', 'video', 'beginner', 'Foundations', 'https://www.youtube.com/watch?v=Ea-IDqL4PnQ', 'Watch the full beginner course and complete the practice questions.', ARRAY['forex','basics'], 1),
('What is a Pip? Lot Sizes & Leverage Explained', 'The three numbers every trader must understand before placing a trade.', 'video', 'beginner', 'Foundations', 'https://www.youtube.com/watch?v=PEnu8O1AHpQ', NULL, ARRAY['pips','lots','leverage'], 2),
('Reading Candlestick Charts', 'How to read a candle, common reversal/continuation patterns.', 'video', 'beginner', 'Technical Analysis', 'https://www.youtube.com/watch?v=Vp9z-l4tngU', NULL, ARRAY['candlesticks','price-action'], 3),
('Support & Resistance Basics', 'Identify key levels where price reacts.', 'video', 'beginner', 'Technical Analysis', 'https://www.youtube.com/watch?v=Yy3EsbgZ7O0', NULL, ARRAY['support','resistance'], 4),
('Risk Management 101', 'Position sizing, the 1% rule, stop losses.', 'video', 'beginner', 'Risk Management', 'https://www.youtube.com/watch?v=8txnK7zU-d8', NULL, ARRAY['risk','psychology'], 5),
('How to Use MetaTrader 5', 'Walkthrough of the MT5 platform you connect to HuMi.', 'video', 'beginner', 'Platforms', 'https://www.youtube.com/watch?v=PQ2lSJUxfMY', NULL, ARRAY['mt5','platform'], 6),
-- INTERMEDIATE
('Smart Money Concepts (SMC) Explained', 'Order blocks, liquidity, fair value gaps.', 'video', 'intermediate', 'Smart Money', 'https://www.youtube.com/watch?v=BUOAyqx_GwI', NULL, ARRAY['smc','smart-money'], 7),
('Multi-Timeframe Analysis', 'Aligning HTF bias with LTF entries.', 'video', 'intermediate', 'Technical Analysis', 'https://www.youtube.com/watch?v=mWg9oPQpYR0', NULL, ARRAY['mtf','top-down'], 8),
('Fibonacci Retracement Strategy', 'How to draw and trade the golden zone.', 'video', 'intermediate', 'Technical Analysis', 'https://www.youtube.com/watch?v=O9MeWTqrqKc', NULL, ARRAY['fibonacci'], 9),
('Trading Psychology — Mark Douglas', 'The classic talk on probabilistic thinking.', 'video', 'intermediate', 'Psychology', 'https://www.youtube.com/watch?v=tpDJQYYzeSk', NULL, ARRAY['psychology','discipline'], 10),
('Synthetic Indices Explained (Deriv)', 'Boom, Crash, Volatility — what they are and how to trade them.', 'video', 'intermediate', 'Synthetics', 'https://www.youtube.com/watch?v=Ns2zFxZf_5U', NULL, ARRAY['synthetics','deriv'], 11),
('Building a Trading Plan', 'Convert a strategy into a written, repeatable plan.', 'video', 'intermediate', 'Planning', 'https://www.youtube.com/watch?v=Wl3p2-ggNkM', NULL, ARRAY['plan','strategy'], 12),
-- ADVANCED
('ICT Mentorship — Market Structure', 'Inner Circle Trader fundamentals on structure shifts.', 'video', 'advanced', 'ICT', 'https://www.youtube.com/watch?v=3pGiBdb4UTc', NULL, ARRAY['ict','structure'], 13),
('Wyckoff Method — Accumulation & Distribution', 'Composite operator theory in modern markets.', 'video', 'advanced', 'Wyckoff', 'https://www.youtube.com/watch?v=YQ7q-N5jVxg', NULL, ARRAY['wyckoff'], 14),
('Order Flow & Liquidity', 'Reading where stops sit and how price hunts them.', 'video', 'advanced', 'Smart Money', 'https://www.youtube.com/watch?v=KE6yX5G1MxY', NULL, ARRAY['order-flow','liquidity'], 15),
('Algorithmic Trading with Python', 'Backtesting and automating strategies.', 'video', 'advanced', 'Automation', 'https://www.youtube.com/watch?v=GDMkkmkJigw', NULL, ARRAY['algo','python','backtest'], 16),
('Hedging Strategies for Forex', 'Pair correlations, partial hedges, basket trading.', 'video', 'advanced', 'Risk Management', 'https://www.youtube.com/watch?v=jbcYSJgoIBQ', NULL, ARRAY['hedging','correlation'], 17),
('Funded Trader Challenges — Pass Strategy', 'Risk rules and execution for prop firm evals.', 'video', 'advanced', 'Prop Trading', 'https://www.youtube.com/watch?v=I1mhykUXt74', NULL, ARRAY['prop','funded'], 18)
ON CONFLICT DO NOTHING;
