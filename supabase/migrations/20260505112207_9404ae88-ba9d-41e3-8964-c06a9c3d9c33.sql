
-- Add missing column for subscriber tracking
ALTER TABLE public.trading_accounts
  ADD COLUMN IF NOT EXISTS copyfactory_subscriber_id text;

-- ============================================
-- Notification trigger functions
-- ============================================

-- 1) New trading signal published -> notify followers
CREATE OR REPLACE FUNCTION public.notify_new_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
           jsonb_build_object('signal_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'link', '/trading-ideas')
      FROM mentor_clients mc
     WHERE mc.mentor_id = NEW.mentor_id;
  ELSE
    -- Admin-published signal -> notify all profiles
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT p.user_id,
           'NEW_IDEA_PUBLISHED',
           'New trade idea published',
           NEW.symbol || ' ' || upper(NEW.direction),
           jsonb_build_object('signal_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'link', '/trading-ideas')
      FROM profiles p;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_signal ON public.trading_signals;
CREATE TRIGGER trg_notify_new_signal
AFTER INSERT ON public.trading_signals
FOR EACH ROW EXECUTE FUNCTION public.notify_new_signal();

-- 2) Trade executed -> notify owner
CREATE OR REPLACE FUNCTION public.notify_trade_executed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_notify_trade_executed ON public.trade_history;
CREATE TRIGGER trg_notify_trade_executed
AFTER INSERT ON public.trade_history
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_executed();

-- 3) AI bot assignment -> notify user
CREATE OR REPLACE FUNCTION public.notify_bot_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot text;
  v_sym text;
  v_dir text;
BEGIN
  SELECT bot_name INTO v_bot FROM ai_bots WHERE id = NEW.bot_id;
  SELECT symbol, direction INTO v_sym, v_dir FROM trading_signals WHERE id = NEW.signal_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'AI_BOT_TRADE',
    COALESCE(v_bot, 'AI Bot') || ' has a new signal',
    COALESCE(v_sym, 'Signal') || ' ' || upper(COALESCE(v_dir, '')),
    jsonb_build_object('assignment_id', NEW.id, 'signal_id', NEW.signal_id, 'link', '/ai-auto-trading')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bot_assignment ON public.ai_bot_assignments;
CREATE TRIGGER trg_notify_bot_assignment
AFTER INSERT ON public.ai_bot_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_bot_assignment();

-- 4) Subscription activated -> notify user
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'SUBSCRIPTION_ACTIVATED',
      'Subscription activated',
      'Your ' || COALESCE(NEW.plan_name, 'plan') || ' subscription is now active.',
      jsonb_build_object('plan', NEW.plan_name, 'link', '/subscription')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.user_subscriptions;
CREATE TRIGGER trg_notify_subscription_change
AFTER INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_change();

-- 5) Trading account connected -> notify user
CREATE OR REPLACE FUNCTION public.notify_account_connected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.connection_status = 'connected'
     AND (TG_OP = 'INSERT' OR OLD.connection_status IS DISTINCT FROM 'connected') THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'ACCOUNT_CONNECTED',
      'Trading account connected',
      COALESCE(NEW.name, 'Account') || ' (' || COALESCE(NEW.platform, '') || ') is ready.',
      jsonb_build_object('account_id', NEW.id, 'link', '/trading-accounts')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_account_connected ON public.trading_accounts;
CREATE TRIGGER trg_notify_account_connected
AFTER INSERT OR UPDATE ON public.trading_accounts
FOR EACH ROW EXECUTE FUNCTION public.notify_account_connected();
