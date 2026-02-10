
-- Fix create_default_wallets: add ON CONFLICT, exception handler, and search_path
CREATE OR REPLACE FUNCTION public.create_default_wallets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO crypto_wallets (user_id, currency, balance, address) VALUES
    (NEW.id, 'BTC', 0, 'bc1q' || substr(md5(NEW.id::text), 1, 38)),
    (NEW.id, 'ETH', 0, '0x' || substr(md5(NEW.id::text || 'eth'), 1, 40)),
    (NEW.id, 'USDT', 0, '0x' || substr(md5(NEW.id::text || 'usdt'), 1, 40)),
    (NEW.id, 'USDC', 0, '0x' || substr(md5(NEW.id::text || 'usdc'), 1, 40)),
    (NEW.id, 'LTC', 0, 'ltc1q' || substr(md5(NEW.id::text || 'ltc'), 1, 38)),
    (NEW.id, 'XRP', 0, 'r' || substr(md5(NEW.id::text || 'xrp'), 1, 33)),
    (NEW.id, 'USD', 0, NULL)
  ON CONFLICT (user_id, currency) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_default_wallets failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Fix reset_monthly_limits: add search_path
CREATE OR REPLACE FUNCTION public.reset_monthly_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_subscriptions
  SET auto_trades_used = 0, last_reset_at = NOW()
  WHERE last_reset_at < NOW() - INTERVAL '1 month';
END;
$$;

-- Fix has_subscription_access: add search_path
CREATE OR REPLACE FUNCTION public.has_subscription_access(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_name TEXT;
  _plan subscription_plans%ROWTYPE;
BEGIN
  SELECT plan_name INTO _plan_name
  FROM user_subscriptions
  WHERE user_id = _user_id AND status = 'active';
  
  IF _plan_name IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT * INTO _plan
  FROM subscription_plans
  WHERE name = _plan_name;
  
  CASE _feature
    WHEN 'ai_bots' THEN RETURN _plan.ai_bots_enabled;
    WHEN 'priority_support' THEN RETURN _plan.priority_support;
    WHEN 'custom_risk' THEN RETURN _plan.custom_risk_enabled;
    ELSE RETURN true;
  END CASE;
END;
$$;
