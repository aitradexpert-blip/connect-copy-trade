UPDATE public.subscription_plans SET price_zar = 349.00, price_usd = 20.00 WHERE lower(name) = 'basic';

CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL UNIQUE,
  commission_pct numeric NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'active',
  bank_name text, account_holder text, account_number text, branch_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own affiliate read" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own affiliate insert" ON public.affiliates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND commission_pct = 50 AND status = 'active');
CREATE POLICY "Own affiliate update" ON public.affiliates FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_affiliates_updated BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- prevent users raising their own commission
CREATE OR REPLACE FUNCTION public.protect_affiliate_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.commission_pct := OLD.commission_pct; NEW.status := OLD.status; NEW.referral_code := OLD.referral_code; NEW.user_id := OLD.user_id;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_affiliate BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.protect_affiliate_fields();

CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  plan_name text,
  period_month date NOT NULL,
  subscription_amount_cents integer NOT NULL,
  commission_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_user_id, referred_user_id, period_month)
);
GRANT SELECT, UPDATE ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliate reads own commissions" ON public.affiliate_commissions FOR SELECT TO authenticated USING (auth.uid() = affiliate_user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin updates commissions" ON public.affiliate_commissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.record_affiliate_commission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ref text; v_aff record; v_price numeric;
BEGIN
  IF NEW.status <> 'active' OR NEW.user_id IS NULL OR lower(coalesce(NEW.plan_name,'free')) = 'free' THEN RETURN NEW; END IF;
  SELECT referred_by INTO v_ref FROM profiles WHERE user_id = NEW.user_id;
  IF v_ref IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_aff FROM affiliates WHERE lower(referral_code) = lower(v_ref) AND status='active';
  IF v_aff IS NULL OR v_aff.user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT price_zar INTO v_price FROM subscription_plans WHERE name = NEW.plan_name;
  IF v_price IS NULL THEN RETURN NEW; END IF;
  INSERT INTO affiliate_commissions(affiliate_user_id, referred_user_id, plan_name, period_month, subscription_amount_cents, commission_cents)
  VALUES (v_aff.user_id, NEW.user_id, NEW.plan_name, date_trunc('month', now())::date, round(v_price*100)::int, round(v_price*100*v_aff.commission_pct/100)::int)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_affiliate_commission AFTER INSERT OR UPDATE OF status, plan_name, expires_at ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.record_affiliate_commission();

-- Mentor marketplace
CREATE TABLE public.mentor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Monthly Signals',
  description text,
  price_cents integer NOT NULL,
  billing_period text NOT NULL DEFAULT 'monthly',
  collection_mode text NOT NULL DEFAULT 'mentor_direct',
  platform_fee_cents integer NOT NULL DEFAULT 17450,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mentor_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_plans TO authenticated;
GRANT ALL ON public.mentor_plans TO service_role;
ALTER TABLE public.mentor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active plans" ON public.mentor_plans FOR SELECT USING (is_active OR auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Mentor manages own plans" ON public.mentor_plans FOR ALL TO authenticated USING (auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK ((auth.uid() = mentor_user_id AND platform_fee_cents = 17450) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mentor_plans_updated BEFORE UPDATE ON public.mentor_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_mentor_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.price_cents < NEW.platform_fee_cents THEN RAISE EXCEPTION 'Price must be at least the platform fee'; END IF;
  IF NEW.collection_mode NOT IN ('mentor_direct','humi_collects') THEN RAISE EXCEPTION 'Invalid collection mode'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_mentor_plan BEFORE INSERT OR UPDATE ON public.mentor_plans FOR EACH ROW EXECUTE FUNCTION public.validate_mentor_plan();

CREATE TABLE public.mentor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id uuid NOT NULL,
  mentor_user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.mentor_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  collection_mode text NOT NULL,
  price_cents_snapshot integer NOT NULL,
  platform_fee_cents_snapshot integer NOT NULL,
  payment_method text,
  payment_reference text,
  proof_url text,
  current_period_end timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mentor_subscriptions TO authenticated;
GRANT ALL ON public.mentor_subscriptions TO service_role;
ALTER TABLE public.mentor_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read subscriptions" ON public.mentor_subscriptions FOR SELECT TO authenticated USING (auth.uid() IN (follower_user_id, mentor_user_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Follower or mentor requests" ON public.mentor_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (follower_user_id, mentor_user_id) AND status = 'pending');
CREATE POLICY "Admin updates subscriptions" ON public.mentor_subscriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mentor_subs_updated BEFORE UPDATE ON public.mentor_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mentor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id uuid NOT NULL,
  follower_user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.mentor_subscriptions(id) ON DELETE SET NULL,
  collection_mode text NOT NULL,
  gross_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  mentor_net_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.mentor_ledger_entries TO authenticated;
GRANT ALL ON public.mentor_ledger_entries TO service_role;
ALTER TABLE public.mentor_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mentor reads own ledger" ON public.mentor_ledger_entries FOR SELECT TO authenticated USING (auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin updates ledger" ON public.mentor_ledger_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.mentor_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id uuid NOT NULL UNIQUE,
  bank_name text NOT NULL, account_holder text NOT NULL, account_number text NOT NULL, branch_code text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mentor_payout_accounts TO authenticated;
GRANT ALL ON public.mentor_payout_accounts TO service_role;
ALTER TABLE public.mentor_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payout account read" ON public.mentor_payout_accounts FOR SELECT TO authenticated USING (auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own payout account insert" ON public.mentor_payout_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = mentor_user_id AND is_verified = false);
CREATE POLICY "Own payout account update" ON public.mentor_payout_accounts FOR UPDATE TO authenticated USING (auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payout_acc_updated BEFORE UPDATE ON public.mentor_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.reset_payout_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    IF (NEW.account_number, NEW.branch_code, NEW.bank_name) IS DISTINCT FROM (OLD.account_number, OLD.branch_code, OLD.bank_name) THEN NEW.is_verified := false;
    ELSE NEW.is_verified := OLD.is_verified; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_reset_payout_verif BEFORE UPDATE ON public.mentor_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.reset_payout_verification();

CREATE TABLE public.mentor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mentor_payouts TO authenticated;
GRANT ALL ON public.mentor_payouts TO service_role;
ALTER TABLE public.mentor_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mentor reads own payouts" ON public.mentor_payouts FOR SELECT TO authenticated USING (auth.uid() = mentor_user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin creates payouts" ON public.mentor_payouts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin updates payouts" ON public.mentor_payouts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Admin approval: activates follower, writes ledger, resumes copying
CREATE OR REPLACE FUNCTION public.approve_mentor_subscription(_subscription_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO s FROM mentor_subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  v_start := greatest(now(), coalesce(s.current_period_end, now()));
  v_end := v_start + interval '1 month';
  UPDATE mentor_subscriptions SET status='active', current_period_end=v_end, approved_at=now(), approved_by=auth.uid() WHERE id=s.id;
  INSERT INTO mentor_ledger_entries(mentor_user_id, follower_user_id, subscription_id, collection_mode, gross_cents, platform_fee_cents, mentor_net_cents, status, period_start, period_end, available_at)
  VALUES (s.mentor_user_id, s.follower_user_id, s.id, s.collection_mode, s.price_cents_snapshot, s.platform_fee_cents_snapshot,
          s.price_cents_snapshot - s.platform_fee_cents_snapshot,
          CASE WHEN s.collection_mode='humi_collects' THEN 'available' ELSE 'fee_due' END, v_start, v_end, now() + interval '1 day');
  UPDATE copy_trading_relationships SET status='active' WHERE follower_user_id=s.follower_user_id AND master_user_id=s.mentor_user_id AND status='inactive';
  INSERT INTO notifications(user_id, type, title, message) VALUES (s.follower_user_id,'subscription','Mentor subscription active','Your mentor subscription is active until '||to_char(v_end,'DD Mon YYYY')||'.');
END $$;
GRANT EXECUTE ON FUNCTION public.approve_mentor_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_mentor_subscriptions() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; n integer := 0;
BEGIN
  FOR s IN SELECT * FROM mentor_subscriptions WHERE status='active' AND current_period_end < now() LOOP
    UPDATE mentor_subscriptions SET status='past_due' WHERE id=s.id;
    UPDATE copy_trading_relationships SET status='inactive' WHERE follower_user_id=s.follower_user_id AND master_user_id=s.mentor_user_id AND status='active';
    INSERT INTO notifications(user_id, type, title, message) VALUES (s.follower_user_id,'subscription','Mentor subscription expired','Copying is paused until your mentor subscription is renewed.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('expire-mentor-subscriptions', '15 * * * *', $$SELECT public.expire_mentor_subscriptions();$$);