# HuMi Surgical Fix Plan — 7 Changes

Precision fixes across quota UX, mentor copy banner, polling cache, POPIA pages, AI bot VPS readiness, and parallel copy fan-out. No changes to `primaryApi.ts`, `vercel.json`, or MetaAPI edge functions (fallback preserved).

## Changes

**1. `src/components/ConnectAccountModal.tsx` — Quota error UX + duplicate guard**

- Detect "quota/limit/exceeded" in the MetaAPI provisioning error and swap the toast to "Account Limit Reached" with an upgrade hint.
- Before the MetaAPI fallback `insert` into `trading_accounts`, look up any existing row for `(user_id, login)` and UPDATE it instead of inserting — kills the ghost-row-on-retry that trips the quota trigger.

**2. `src/pages/MentorCenter.tsx` — Mentor-side copy banner**

- `CopyTradingActiveBanner` uses `useCopyTrading`, which filters `follower_user_id = user.id` (always 0 for mentors).
- Replace the banner instance in MentorCenter with a mentor-perspective card driven by the already-loaded `copyRelationships` state, showing active follower count. Keep `CopyTradingActiveBanner` untouched (still correct for followers on CopyTradingNew / MentorHub).

**3. `src/pages/Index.tsx` — Module-level MetaAPI polling cache**

- Add a module-scope `_lastMetaApiFetch` timestamp + `META_FETCH_INTERVAL_MS = 60_000`.
- Wrap the `metaapi-get-positions` invoke in a time-gate so simultaneous child mounts collapse to one call/minute. VPS loading path untouched.

**4. `src/pages/Settings.tsx` — Legal & Privacy card**

- Append a new Card after the last existing Card with links to `/legal/privacy-policy`, `/legal/terms-of-service`, `/legal/risk-disclosure`, `/legal/popia-notice`, `/legal/cookie-policy`. Uses existing design tokens.

**5. `src/App.tsx` + new `src/pages/LegalPage.tsx` — POPIA pages**

- Add `<Route path="/legal/:page" element={<ProtectedRoute><LegalPage /></ProtectedRoute>} />`.
- New `LegalPage.tsx` renders one of five static POPIA-compliant documents (Privacy, Terms, Risk, POPIA Notice, Cookies) via a `useParams` lookup, wrapped in `AppLayout` with a Back button.

**6. `src/pages/AIAutoTrading.tsx` — VPS-ready bot activation**

- Extend the `ready` check to accept `provider === 'vps' || connection_type === 'vps'`.
- Active-bots badge shows "VPS Direct" for VPS accounts (Deriv/MetaAPI branches preserved).

**7. `supabase/functions/copy-trade-listener/index.ts` — Parallel VPS-first fan-out**

- Note: file already uses `runWithConcurrency` (5-way) with a VPS-first branch and MetaAPI fallback. The requested "sequential for-loop → Promise.allSettled" refactor is already in place. Apply only the two deltas from the user's spec that aren't in current code:
  - Add per-follower `AbortController` with 8s timeout on the VPS `/order` fetch.
  - Enforce `Math.max(0.01, ...)` floor on `adjustedVolume`.
- Leave existing audit-log-on-failure + `Promise.allSettled` result shape untouched.

## Not touched

`primaryApi.ts`, `vercel.json`, `sw.js`, `robots.txt`, `metaapi-*` edge functions, `usePushNotifications.ts`, `send-push-notification`, `BottomNav`, `AppLayout`, `useCopyTrading` (still correct for the follower dashboards).

## Manual dev actions (out of scope for code)

1. Verify ngrok tunnel: `https://municipal-posh-shading.ngrok-free.dev/docs` reachable.  - It is reachable
2. Vercel env `VITE_API_URL` set to the ngrok URL; redeploy if changed. - This is set
3. On next connect attempt, watch console for `[VPS] Response received:` — absence means `VITE_API_URL` not baked into build.
4. One-off Supabase SQL to clear ghost rows:
  ```sql
   DELETE FROM trading_accounts
   WHERE connection_status = 'connecting'
     AND created_at < NOW() - INTERVAL '10 minutes';
  ```
5. Basic-tier 1-account cap is enforced server-side by `consume_subscription_quota` (already returns limit=1 for Basic on `trading_account_additions`) — no migration needed.

## VPS status check (what's implemented today)

- Frontend: `ConnectAccountModal` posts to `${VITE_API_URL}/connect` first, MetaAPI fallback on failure. "Test VPS" button pings `/health`.
- Execution: `brokerExecution.ts` routes `provider==='vps'` through `primaryApi.sendOrder` first.
- Fan-out: `copy-trade-listener` calls `${VPS_API_URL}/order` per VPS follower, MetaAPI fallback otherwise.
- Required on VPS: `GET /health`, `POST /connect`, `POST /order` endpoints; `X-VPS-Secret` header check must match the `VPS_API_SECRET` edge-function secret.  
  
  
Lovable's plan says "add a module-level `_lastMetaApiFetch` timestamp and wrap the `metaapi-get-positions` invoke in a time-gate." **I read Index.tsx in full.** The MetaAPI path calls `metaapi-account-info` AND `metaapi-get-positions` as separate invokes inside the same `if (account.metaapi_account_id)` block. The plan only mentions caching get-positions. If you only gate positions but not account-info, you still get duplicate 502s on account-info, which is the heavier call. The plan is incomplete — both calls need the gate or neither does.
  **Counter-argument:** Actually looking at the logs more carefully — positions fires 3-4x simultaneously but account-info fires at the same frequency. The root cause is the `useEffect` running once per account in the `for` loop without any deduplication. The real fix isn't a module-level cache; it's that `loadAccountsAndMetrics` is being called multiple times on mount. Looking at Index.tsx — there is only ONE `useEffect` calling `loadAccountsAndMetrics`. So something OUTSIDE Index.tsx is also calling it. Likely a parent component re-mounting. **The module-level cache is still the right fix, but it needs to cover both metaapi-account-info AND metaapi-get-positions, not just one.**  
    
    
  Lovable's plan says "Apply only the two deltas: AbortController with 8s timeout + Math.max(0.01) floor." I read the actual live file. The VPS fetch already has NO AbortController — correct. But looking at the adjustedVolume calculation: `Number((signal.lot_size * balanceRatio).toFixed(2))`. If `signal.lot_size` is 0.01 and `balanceRatio` is 0.001 (follower has tiny account vs master), the result is `0.00` — which gets passed to the broker and will error. The Math.max(0.01) floor is genuinely needed. Both deltas are valid and non-breaking. **Lovable is right here, but needs exact anchor strings or it will modify the wrong block.**  
    
    
  The plan says "look up existing row for (user_id, login) and UPDATE instead of inserting." Looking at ConnectAccountModal — the VPS path already creates a placeholder row (`connection_status: 'connecting'`) BEFORE calling VPS. If VPS fails and falls through to MetaAPI, there could ALREADY be a row with that login from the VPS placeholder — but the VPS path deletes it on failure. However if the VPS path throws mid-execution (not the happy-path delete), the placeholder row survives. This is the ghost row. **The fix is valid but also requires the manual SQL to clean existing ghosts first, otherwise the upsert will hit the existing ghost and update it to metaapi provider while it was created as vps provider — causing a schema conflict.**  
    
    
  Lovable says "replace the `<CopyTradingActiveBanner />` with a mentor-perspective card." I confirmed the anchor exists in MentorCenter. The `copyRelationships` state IS loaded and already filtered. **This is correct and clean. No leak here.**
  **Argument 5 vs Change 4/5 (POPIA pages)**  
  The plan puts LegalPage behind `<ProtectedRoute>`. But Privacy Policy, Terms of Service, and Risk Disclosure must be publicly accessible — users who haven't registered yet need to read them before agreeing. Requiring login to view your own terms of service violates POPIA requirements in South Africa. **This is a real bug in the plan. The route must be public, not protected.**  
    
    
  PRE-FLIGHT: HOLES FOUND AND SEALED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOLE 1 — POLLING CACHE: PLAN ONLY GATES get-positions, NOT account-info Index.tsx calls BOTH metaapi-account-info AND metaapi-get-positions in the same account loop. Live logs show BOTH firing 3-4x simultaneously. The plan caches only one. Fix: gate BOTH with the same timestamp guard.
  HOLE 2 — GHOST ROW + UPSERT CONFLICT The VPS path creates a row with provider='vps' before calling VPS. On VPS failure it tries to delete it. If the delete fails mid-exception, a ghost row survives with provider='vps'. The MetaAPI fallback then tries to INSERT a new row for the same (user_id, login). The duplicate guard plan does a SELECT → UPDATE. But UPDATE-ing a 'vps' provider row with metaapi data (metaapi_account_id, connection_type='metaapi') creates a corrupted row. Fix: the upsert must also update provider and connection_type fields, or better: the placeholder row should be cleaned up in the CATCH block too.
  HOLE 3 — POPIA PAGES BEHIND PROTECTED ROUTE Legal pages (Privacy Policy, Terms, Risk Disclosure) must be PUBLIC. South African POPIA requires these to be accessible BEFORE registration. Putting them behind ProtectedRoute violates this. Fix: use a plain <Route> with no auth wrapper, or wrap in a minimal layout without the auth guard.
  HOLE 4 — ADJUSTEDVOLUME FLOOR ONLY, NOT CEILING Math.max(0.01, adjustedVolume) floors at 0.01 lots. But if the follower has a much larger balance than the master, adjustedVolume could be 50+ lots on a 0.01 master signal, which could blow the follower's account or be rejected by the broker as exceeding max order size. Fix: add a ceiling cap of 10 lots as a safety rail alongside the floor.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PASTE EVERYTHING BELOW THIS LINE INTO LOVABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  You are a senior engineer executing precision surgical fixes. Read every file listed in each change before touching anything. Make ONLY the changes described. Do not modify any unlisted file. Do not touch: primaryApi.ts, vercel.json, sw.js, useCopyTrading.ts, CopyTradingActiveBanner.tsx, BottomNav.tsx, AppLayout.tsx, or any metaapi-* edge function file except copy-trade-listener.
  ═══════════════════════════════════════════════ CHANGE 1 — Quota UX + Ghost Row Fix FILE: src/components/ConnectAccountModal.tsx ═══════════════════════════════════════════════
  Read the file. Make two changes inside handleMetaApiSubmit.
  ── CHANGE 1A: Humanise the quota error message ──
  FIND this exact string (inside the !res.ok block):
  ```
  description: res.errorMessage || "Could not reach Trading Bridge. Deploy `metaapi-provision-account` and set METAAPI_TOKEN.",
  ```
  REPLACE WITH:
  typescript
  ```typescript
  description: (() => {
    const msg = res.errorMessage || "";
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("exceeded")) {
      return "Your plan allows 1 trading account. Please upgrade your subscription or remove an existing account before adding a new one.";
    }
    return msg || "Could not connect your account. Check your credentials and try again.";
  })(),
  ```
  ── CHANGE 1B: Clean up ghost 'connecting' row in the VPS catch block ──
  FIND this exact string in the VPS catch block:
  typescript
  ```typescript
  } catch (vpsError) {
    console.warn("VPS unreachable, falling back to MetaAPI:", vpsError);
  }
  ```
  REPLACE WITH:
  typescript
  ```typescript
  } catch (vpsNetworkError: any) {
    console.error('[VPS] Network error, falling through to MetaAPI:', vpsNetworkError?.message);
    // Clean up any ghost placeholder row from the failed VPS attempt
    // so it does not count against the user's quota on retry
    try {
      if (newAccount?.id) {
        await supabase.from("trading_accounts").delete().eq("id", newAccount.id);
      }
    } catch { /* ignore cleanup error */ }
  }
  ```
  ── CHANGE 1C: Prevent duplicate insert on MetaAPI retry ──
  FIND this exact string (immediately before the MetaAPI insert):
  typescript
  ```typescript
  const { error: insertError } = await supabase
    .from("trading_accounts")
    .insert([{
      user_id: user.id,
      provider: 'metaapi',
  ```
  REPLACE WITH:
  typescript
  ```typescript
  // Check for a ghost row from a previous failed attempt before inserting
  const { data: ghostRow } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('login', formData.login.replace(/\D/g, '') || formData.login)
    .maybeSingle();

  if (ghostRow?.id) {
    // Update the existing row rather than inserting — prevents quota double-count
    await supabase.from('trading_accounts').update({
      provider: 'metaapi',
      connection_type: 'metaapi',
      metaapi_account_id: data2.metaapi_account_id,
      name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`,
      server: formData.server,
      platform: formData.platform,
      connection_status: data2.state === 'DEPLOYED' ? 'connected' : 'provisioning',
    }).eq('id', ghostRow.id);
    toast({ title: "Account connected!", description: `${formData.name || formData.login} has been connected successfully.` });
    resetAndClose();
    setIsLoading(false);
    return;
  }

  const { error: insertError } = await supabase
    .from("trading_accounts")
    .insert([{
      user_id: user.id,
      provider: 'metaapi',
  ```
  Do not change anything else in this file.
  ═══════════════════════════════════════════════ CHANGE 2 — Mentor-side Copy Trading Banner FILE: src/pages/MentorCenter.tsx ═══════════════════════════════════════════════
  Read the file. Make one change.
  FIND this exact line near the top of the main return() block:
  tsx
  ```tsx
  <CopyTradingActiveBanner />
  ```
  REPLACE WITH:
  tsx
  ```tsx
  {/* Mentor master-side banner — shows when followers are actively copying.
      NOTE: CopyTradingActiveBanner uses useCopyTrading which queries follower_user_id.
      Mentors are masters, not followers, so that hook always returns 0 for them.
      We use the already-loaded copyRelationships state directly instead. */}
  {copyRelationships.filter(r => r.status === 'active').length > 0 && (
    <Card className="border-profit/30 bg-profit/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-profit animate-pulse flex-shrink-0" />
          <div>
            <p className="font-semibold text-profit">
              Copy Trading Active — {copyRelationships.filter(r => r.status === 'active').length} follower
              {copyRelationships.filter(r => r.status === 'active').length !== 1 ? 's' : ''} copying you
            </p>
            <p className="text-sm text-muted-foreground">
              Your published trades are being automatically mirrored to your followers' accounts
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )}
  ```
  Do not change useCopyTrading, CopyTradingActiveBanner, or any other file.
  ═══════════════════════════════════════════════ CHANGE 3 — MetaAPI Polling Cache (BOTH calls) FILE: src/pages/Index.tsx ═══════════════════════════════════════════════
  Read the file. Make one change.
  FIND this exact line near the top of the file, BEFORE `const LatestSignalCard`: (If the line does not exist, add it before `const LatestSignalCard`)
  ADD this block immediately before `const LatestSignalCard = () => {`:
  typescript
  ```typescript
  // Module-level cache — prevents duplicate MetaAPI calls when multiple
  // component instances mount simultaneously (confirmed via live Supabase logs:
  // metaapi-account-info and metaapi-get-positions fire 3-4x per render cycle)
  let _lastMetaApiFetch = 0;
  const META_FETCH_COOLDOWN = 60_000; // 60 seconds minimum between MetaAPI calls
  ```
  Then FIND this exact block inside the loadAccountsAndMetrics function:
  typescript
  ```typescript
            // ── MetaAPI account info (history removed — 502s from edge fn) ─
            if (account.metaapi_account_id) {
              const { data: info, error: fnError } = await supabase.functions.invoke(
                "metaapi-account-info", { body: { accountId: account.metaapi_account_id } }
              );
  ```
  REPLACE WITH:
  typescript
  ```typescript
            // ── MetaAPI account info (rate-gated to prevent duplicate parallel calls) ─
            if (account.metaapi_account_id) {
              const now = Date.now();
              const shouldCallMetaApi = now - _lastMetaApiFetch > META_FETCH_COOLDOWN;
              if (shouldCallMetaApi) _lastMetaApiFetch = now;

              const { data: info, error: fnError } = shouldCallMetaApi
                ? await supabase.functions.invoke("metaapi-account-info", { body: { accountId: account.metaapi_account_id } })
                : { data: null, error: new Error('rate-limited') };
  ```
  Then FIND the metaapi-get-positions call immediately after:
  typescript
  ```typescript
                const { data: positionsData } = await supabase.functions.invoke(
                  "metaapi-get-positions", { body: { accountId: account.metaapi_account_id } }
                );
  ```
  REPLACE WITH:
  typescript
  ```typescript
                const { data: positionsData } = shouldCallMetaApi
                  ? await supabase.functions.invoke("metaapi-get-positions", { body: { accountId: account.metaapi_account_id } })
                  : { data: null };
  ```
  Do not change VPS, Deriv, or any other block in this function.
  ═══════════════════════════════════════════════ CHANGE 4 — Legal & Privacy Card in Settings FILE: src/pages/Settings.tsx ═══════════════════════════════════════════════
  Read the file. Find the last <Card> component before the closing </div> of the main return. ADD this new Card AFTER the last existing Card:
  tsx
  ```tsx
  <Card className="bg-gradient-card border-border shadow-card">
    <CardHeader>
      <CardTitle className="text-base">Legal & Privacy</CardTitle>
      <CardDescription>South African POPIA compliance and platform policies</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {([
        ["Privacy Policy", "How we collect and protect your personal information (POPIA)"],
        ["Terms of Service", "Platform usage terms and conditions"],
        ["Risk Disclosure", "Trading risks — read before you trade"],
        ["POPIA Notice", "Your rights under the Protection of Personal Information Act"],
        ["Cookie Policy", "How we use cookies and similar technologies"],
      ] as [string, string][]).map(([label, desc]) => (
        <button
          key={label}
          onClick={() => navigate(`/legal/${label.toLowerCase().replace(/\s+/g, '-')}`)}
          className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
        >
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      ))}
    </CardContent>
  </Card>
  ```
  Add ExternalLink to the lucide-react import if not already there. Verify navigate is already in use in this file — if not, add: `import { useNavigate } from "react-router-dom";` and `const navigate = useNavigate();` Do not change anything else.
  ═══════════════════════════════════════════════ CHANGE 5 — POPIA Legal Pages (PUBLIC — no auth) FILES: src/App.tsx + NEW src/pages/LegalPage.tsx ═══════════════════════════════════════════════
  ── CHANGE 5A: Add public route in App.tsx ──
  Read src/App.tsx. Find the last <Route> before </Routes>. ADD this route after it — it must NOT be wrapped in ProtectedRoute or AdminRoute, because legal pages must be publicly accessible under South African law:
  tsx
  ```tsx
  <Route path="/legal/:page" element={<LegalPage />} />
  ```
  Add to the imports at the top of App.tsx:
  typescript
  ```typescript
  import LegalPage from "@/pages/LegalPage";
  ```
  ── CHANGE 5B: Create the new file ──
  Create NEW file `src/pages/LegalPage.tsx` with this exact content:
  tsx
  ```tsx
  import { useParams, useNavigate } from "react-router-dom";
  import AppLayout from "@/components/AppLayout";
  import { Button } from "@/components/ui/button";
  import { ArrowLeft } from "lucide-react";

  const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
    "privacy-policy": {
      title: "Privacy Policy",
      body: `HuMi Mobile is committed to protecting your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA).

  RESPONSIBLE PARTY
  HuMi Mobile (Pty) Ltd — support@humi.co.za

  INFORMATION WE COLLECT
  Name, email address, trading account identifiers (login IDs, server names), usage data, and device information. We do NOT store MT4/MT5 passwords after the initial connection is established.

  HOW WE USE YOUR INFORMATION
  To provide platform services, execute trading instructions on your behalf, send service notifications, comply with legal obligations, and improve our platform.

  DATA STORAGE & SECURITY
  Your data is stored on Supabase infrastructure hosted in secure data centres. We use TLS encryption in transit and AES encryption at rest. We do not sell personal information to third parties.

  YOUR RIGHTS UNDER POPIA
  You have the right to: access your personal information, request correction, request deletion, object to processing, and lodge a complaint with the Information Regulator of South Africa (inforegulator.org.za).

  DATA RETENTION
  Account data is retained for the duration of your subscription plus 5 years as required by South African financial services regulations.

  CONTACT
  Information Officer: support@humi.co.za`,
    },
    "terms-of-service": {
      title: "Terms of Service",
      body: `HUMI MOBILE — TERMS OF SERVICE
  Last updated: July 2026

  1. PLATFORM NATURE
  HuMi is a technology platform only. We do not provide financial advice, investment recommendations, or portfolio management services. All trading signals, copy trading features, and AI bot outputs are informational and educational in nature.

  2. RISK ACKNOWLEDGEMENT
  Trading financial instruments carries substantial risk of loss. You may lose some or all of your invested capital. Past results do not guarantee future performance. You trade entirely at your own risk.

  3. ACCOUNT SECURITY
  You are responsible for maintaining the security of your HuMi login credentials. HuMi has trade-only API access to connected broker accounts and cannot withdraw funds from any broker account.

  4. SUBSCRIPTION & BILLING
  Basic plan: 1 trading account, access to signals and copy trading features.
  Subscriptions are billed monthly. Fees are non-refundable once a billing period has commenced. You may cancel at any time; access continues until the end of the paid period.

  5. ACCEPTABLE USE
  You may not use HuMi to violate any applicable law or broker terms of service, engage in market manipulation, or attempt to access other users' accounts.

  6. GOVERNING LAW
  These terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the jurisdiction of South African courts.

  7. CONTACT
  support@humi.co.za`,
    },
    "risk-disclosure": {
      title: "Risk Disclosure Statement",
      body: `IMPORTANT — PLEASE READ CAREFULLY

  Trading forex, CFDs, commodities, indices, and other financial instruments involves substantial risk of loss and is not appropriate for all investors.

  KEY RISKS:
  - You may lose your entire invested capital
  - Leverage amplifies both potential profits and potential losses significantly
  - Past performance of any trading signal, mentor, or AI bot is not indicative of future results
  - Copy trading results achieved by others may not be replicated in your account due to differences in account size, timing, broker execution, and market conditions
  - Automated trading (AI bot) may malfunction, execute at unfavourable prices, or fail to execute under certain market conditions
  - Cryptocurrency and exotic forex pairs may experience extreme volatility

  HuMi does not guarantee trading profits under any circumstances. All trading ideas and signals are provided for informational and educational purposes only and do not constitute financial advice as defined under the Financial Advisory and Intermediary Services Act (FAIS) of South Africa.

  You should only trade with money you can afford to lose. If you are uncertain about your risk tolerance, please seek independent financial advice from a licensed Financial Services Provider (FSP) registered with the Financial Sector Conduct Authority (FSCA).`,
    },
    "popia-notice": {
      title: "POPIA Information Notice",
      body: `PROTECTION OF PERSONAL INFORMATION ACT (POPIA) — ACT 4 OF 2013
  Effective: 1 July 2021

  RESPONSIBLE PARTY
  HuMi Mobile (Pty) Ltd
  Information Officer: support@humi.co.za

  PURPOSE OF COLLECTION
  We collect and process your personal information solely for the purpose of providing our trading technology platform, including account management, signal delivery, copy trading functionality, and subscription billing.

  LAWFUL BASIS
  Processing is based on: (a) your explicit consent provided at registration; (b) contractual necessity to provide services you have requested; (c) compliance with legal obligations under South African financial services regulation.

  CATEGORIES OF DATA PROCESSED
  Personal identifiers (name, email), trading account credentials (login IDs and server names only — not passwords after connection), usage and activity data, subscription and billing data, and device and session information.

  CROSS-BORDER TRANSFERS
  Your data may be processed by service providers located outside South Africa, including Supabase (USA), Vercel (USA), and Brevo (France). Appropriate cross-border transfer safeguards as required by POPIA Section 72 are in place.

  DATA RETENTION
  Active account data: for the duration of your subscription.
  Post-cancellation: 5 years as required by FICA and financial services regulations.
  Marketing data: until you unsubscribe.

  YOUR RIGHTS
  Under POPIA you have the right to:
  - Access your personal information (submit request to support@humi.co.za)
  - Request correction of inaccurate information
  - Request deletion of your information (subject to legal retention requirements)
  - Object to processing of your information
  - Lodge a complaint with the Information Regulator: inforegulator.org.za

  COMPLAINTS
  If you believe your POPIA rights have been violated, contact our Information Officer at support@humi.co.za. If unresolved within 30 days, you may escalate to the Information Regulator of South Africa.`,
    },
    "cookie-policy": {
      title: "Cookie Policy",
      body: `HUMI MOBILE — COOKIE & TRACKING POLICY

  WHAT WE USE
  HuMi uses session tokens (stored in browser local storage, not cookies) to keep you logged in. These are essential and cannot be disabled.

  We use anonymised, aggregated analytics to understand how users interact with the platform. No personally identifiable information is included in analytics data.

  WHAT WE DO NOT USE
  - Advertising or tracking cookies
  - Third-party marketing pixels
  - Social media tracking
  - Fingerprinting technologies

  YOUR CHOICES
  Since we rely on session tokens rather than traditional cookies for core functionality, standard browser cookie controls do not affect platform access. To delete your session data, log out of HuMi.

  For questions about our data practices, contact support@humi.co.za`,
    },
  };

  export default function LegalPage() {
    const { page } = useParams<{ page: string }>();
    const navigate = useNavigate();
    const content = page ? LEGAL_CONTENT[page] : undefined;

    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-4 pb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          {content ? (
            <>
              <h1 className="text-2xl font-bold text-foreground">{content.title}</h1>
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed">
                    {content.body}
                  </pre>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Legal page not found.</p>
              <Button variant="link" onClick={() => navigate('/settings')}>Back to Settings</Button>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }
  ```
  Add Card and CardContent to the imports in LegalPage.tsx:
  typescript
  ```typescript
  import { Card, CardContent } from "@/components/ui/card";
  ```
  ═══════════════════════════════════════════════ CHANGE 6 — AI Bot VPS Activation Fix FILE: src/pages/AIAutoTrading.tsx ═══════════════════════════════════════════════
  Read the file. Make two changes.
  ── CHANGE 6A: Extend ready check ──
  FIND this exact string:
  typescript
  ```typescript
  const ready = !!acc && (
    (acc.provider === 'deriv' && !!acc.deriv_token) ||
    (acc.provider === 'metaapi' && !!acc.metaapi_account_id && UUID_RE.test(acc.metaapi_account_id))
  );
  ```
  REPLACE WITH:
  typescript
  ```typescript
  const ready = !!acc && (
    (acc.provider === 'deriv' && !!acc.deriv_token) ||
    (acc.provider === 'metaapi' && !!acc.metaapi_account_id && UUID_RE.test(acc.metaapi_account_id)) ||
    (acc.provider === 'vps' || (acc as any).connection_type === 'vps')
  );
  ```
  ── CHANGE 6B: VPS badge in active bots list ──
  FIND this exact string:
  tsx
  ```tsx
  {assignment.trading_accounts?.provider === 'deriv' ? (
    <><Zap className="w-3 h-3 mr-1" />Deriv</>
  ) : 'MetaAPI'}
  ```
  REPLACE WITH:
  tsx
  ```tsx
  {assignment.trading_accounts?.provider === 'deriv'
    ? <><Zap className="w-3 h-3 mr-1" />Deriv</>
    : assignment.trading_accounts?.provider === 'vps'
    ? 'VPS Direct'
    : 'MetaAPI'}
  ```
  Do not change anything else in this file.
  ═══════════════════════════════════════════════ CHANGE 7 — copy-trade-listener: AbortController + Volume Safety FILE: supabase/functions/copy-trade-listener/index.ts ═══════════════════════════════════════════════
  Read the file. Make two surgical changes only. The runWithConcurrency(5) structure already exists — do NOT rewrite it.
  ── CHANGE 7A: Add AbortController timeout to VPS fetch ──
  FIND this exact string inside the VPS branch:
  typescript
  ```typescript
          if (isVpsAccount && VPS_URL) {
            try {
              const vpsRes = await fetch(`${VPS_URL}/order`, {
                method: 'POST',
                headers: {
  ```
  REPLACE WITH:
  typescript
  ```typescript
          if (isVpsAccount && VPS_URL) {
            try {
              const vpsCtrl = new AbortController();
              const vpsTimeout = setTimeout(() => vpsCtrl.abort(), 8000);
              const vpsRes = await fetch(`${VPS_URL}/order`, {
                method: 'POST',
                signal: vpsCtrl.signal,
                headers: {
  ```
  Then find the first line AFTER the fetch call closes (just after the body JSON.stringify):
  typescript
  ```typescript
              });
              const vpsResult = await vpsRes.json().catch(() => null);
  ```
  REPLACE WITH:
  typescript
  ```typescript
              }).finally(() => clearTimeout(vpsTimeout));
              const vpsResult = await vpsRes.json().catch(() => null);
  ```
  ── CHANGE 7B: Add volume floor AND ceiling ──
  FIND this exact string:
  typescript
  ```typescript
        const adjustedVolume = Number((signal.lot_size * balanceRatio).toFixed(2));
  ```
  REPLACE WITH:
  typescript
  ```typescript
        // Floor: 0.01 (minimum broker lot). Ceiling: 10.0 (safety cap — prevents
        // oversized orders when follower balance >> master balance).
        const rawVolume = signal.lot_size * balanceRatio;
        const adjustedVolume = Number(Math.min(10.0, Math.max(0.01, rawVolume)).toFixed(2));
  ```
  Do not change runWithConcurrency, auditFailure, corsHeaders, MetaAPI fallback logic, or the return Response block.
  ═══════════════════════════════════════════════════════ COMMIT MESSAGE ═══════════════════════════════════════════════════════ "fix: quota UX + ghost row, mentor master banner, MetaAPI rate gate, POPIA pages (public), AI bot VPS, copy-trade AbortController + volume safety"