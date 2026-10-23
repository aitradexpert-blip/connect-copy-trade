// Master position lifecycle mirroring.
//  - mode "cron"  : (pg_cron, every minute) watch every Master account's live
//                   MT5 positions; mirror new terminal trades to followers and
//                   mirror closes (from MT5 mobile / VPS terminal / SL / TP).
//  - mode "sync"  : same, for one account the caller owns (instant refresh).
//  - mode "close" : Master pressed "Close Trade" in HuMi — close the Master's
//                   position first, then every follower copy of it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
const VPS_SECRET = Deno.env.get('VPS_API_SECRET') || '';
const METAAPI_TOKEN = Deno.env.get('METAAPI_TOKEN') || '';
const db = createClient(SUPABASE_URL, SERVICE_KEY);
const vpsHeaders = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', 'x-vps-secret': VPS_SECRET };

type Pos = { ticket: string; symbol: string; direction: 'BUY' | 'SELL'; volume: number; open_price: number | null; profit: number | null; sl: number | null; tp: number | null; opened_at: string | null };

async function vps(method: 'GET' | 'POST', path: string, body?: unknown, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${VPS_URL}${path}`, { method, headers: vpsHeaders, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const j = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, json: j as any };
  } catch (e: any) {
    return { ok: false, status: 0, json: { error: e?.name === 'AbortError' ? 'timed out' : String(e?.message || e) } };
  } finally { clearTimeout(t); }
}

function normPos(p: any): Pos | null {
  const ticket = p.ticket ?? p.identifier ?? p.id ?? p.position ?? p.positionId;
  if (ticket == null) return null;
  const tRaw = p.type ?? p.direction ?? p.side;
  const isSell = tRaw === 1 || /sell/i.test(String(tRaw));
  const time = p.time ?? p.time_msc ?? p.openTime ?? p.time_setup;
  let opened: string | null = null;
  if (typeof time === 'number') opened = new Date(time > 1e12 ? time : time * 1000).toISOString();
  else if (typeof time === 'string') opened = new Date(time).toISOString();
  return {
    ticket: String(ticket), symbol: String(p.symbol || ''), direction: isSell ? 'SELL' : 'BUY',
    volume: Number(p.volume ?? p.lots ?? 0), open_price: p.price_open ?? p.openPrice ?? null,
    profit: p.profit ?? p.unrealizedProfit ?? null, sl: p.sl ?? p.stopLoss ?? null, tp: p.tp ?? p.takeProfit ?? null, opened_at: opened,
  };
}

// ---- Shared-terminal binding -------------------------------------------------
async function bindVps(acc: any): Promise<string | null> {
  const info = await vps('GET', `/account?id=${acc.id}`, undefined, 10000);
  if (info.json?.data?.login && String(info.json.data.login) === String(acc.login)) return null;
  if (!acc.mt5_password) return 'Account has no stored MT5 password — reconnect it in Trading Accounts';
  const c = await vps('POST', '/connect', { login: parseInt(String(acc.login), 10), password: acc.mt5_password, server: acc.server, account_id: acc.id }, 15000);
  if (!c.json?.success) return c.json?.error || c.json?.detail || `VPS /connect HTTP ${c.status}`;
  const again = await vps('GET', `/account?id=${acc.id}`, undefined, 10000);
  if (String(again.json?.data?.login) !== String(acc.login)) return 'Trading terminal did not switch to this account';
  return null;
}

// ---- MetaAPI -----------------------------------------------------------------
async function metaApiBase(accountId: string) {
  const r = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`, { headers: { 'auth-token': METAAPI_TOKEN } });
  const region = r.ok ? ((await r.json()).region || 'vint-hill') : 'vint-hill';
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${accountId}`;
}

async function readPositions(acc: any): Promise<{ positions?: Pos[]; error?: string }> {
  if (acc.connection_type === 'vps' || acc.provider === 'vps') {
    if (!VPS_URL) return { error: 'Trading bridge address not configured' };
    const bindErr = await bindVps(acc);
    if (bindErr) return { error: bindErr };
    const r = await vps('GET', `/positions?id=${acc.id}`);
    if (!r.json?.success || !Array.isArray(r.json.data)) return { error: r.json?.error || `VPS /positions HTTP ${r.status}` };
    // Re-confirm the terminal is still on this login — otherwise the list could
    // belong to someone else and we'd mirror phantom closes.
    const chk = await vps('GET', `/account?id=${acc.id}`, undefined, 10000);
    if (String(chk.json?.data?.login) !== String(acc.login)) return { error: 'Terminal switched account mid-read' };
    return { positions: r.json.data.map(normPos).filter(Boolean) as Pos[] };
  }
  if (acc.metaapi_account_id && METAAPI_TOKEN) {
    const base = await metaApiBase(acc.metaapi_account_id);
    const r = await fetch(`${base}/positions`, { headers: { 'auth-token': METAAPI_TOKEN } });
    if (!r.ok) return { error: `MetaAPI positions HTTP ${r.status}` };
    return { positions: ((await r.json()) as any[]).map(normPos).filter(Boolean) as Pos[] };
  }
  return { error: 'No live connection for this account' };
}

async function closeOnAccount(acc: any, ticket: string, symbol: string, volume: number): Promise<string | null> {
  if (acc.connection_type === 'vps' || acc.provider === 'vps') {
    const bindErr = await bindVps(acc);
    if (bindErr) return bindErr;
    const r = await vps('POST', '/close', { accountId: acc.id, account_id: acc.id, ticket: Number(ticket), symbol, volume }, 20000);
    if (r.status === 404 || r.status === 405) return 'Trading bridge has no /close endpoint yet — install the close update on the VPS';
    const d = r.json?.data ?? r.json;
    if (r.json?.success === true || d?.retcode === 10009 || d?.retcode === 10008) return null;
    if (/not\s+found|no\s+position|already\s+closed/i.test(String(r.json?.error || ''))) return null; // already flat
    return r.json?.error || d?.comment || `Close failed (HTTP ${r.status}${d?.retcode ? `, retcode ${d.retcode}` : ''})`;
  }
  if (acc.metaapi_account_id && METAAPI_TOKEN) {
    const base = await metaApiBase(acc.metaapi_account_id);
    const r = await fetch(`${base}/trade`, {
      method: 'POST', headers: { 'auth-token': METAAPI_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'POSITION_CLOSE_ID', positionId: ticket }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && (j?.numericCode === 0 || j?.numericCode === 10009 || j?.stringCode === 'TRADE_RETCODE_DONE' || !j?.error)) return null;
    if (/not\s+found/i.test(JSON.stringify(j))) return null;
    return j?.message || j?.error || `MetaAPI close HTTP ${r.status}`;
  }
  return 'No live connection for this account';
}

// Close every follower copy of one Master position — strictly one at a time
// because VPS followers share a single MT5 terminal.
// Matching is layered so a close can never silently hit "0 matched" again:
//   1. exact master_ticket link, 2. the Master position's signal_id,
//   3. fallback: unlinked open copies of the same pair + direction on this
//      master (dual-watcher duplicates carry a different signal_id).
async function closeFollowers(mp: any, reason: string) {
  const filters = [`master_ticket.eq.${mp.ticket}`];
  if (mp.signal_id) filters.push(`signal_id.eq.${mp.signal_id}`);
  const selectCols = 'id, trading_account_id, broker_ticket, broker_symbol, symbol, direction, volume, user_id, signal_id';
  let { data: rows } = await db.from('trade_history')
    .select(selectCols)
    .eq('master_account_id', mp.master_account_id).eq('status', 'open').not('broker_ticket', 'is', null)
    .or(filters.join(','));
  if (!rows || rows.length === 0) {
    const { data: unlinked } = await db.from('trade_history')
      .select(selectCols)
      .eq('master_account_id', mp.master_account_id).eq('status', 'open')
      .not('broker_ticket', 'is', null).is('master_ticket', null);
    rows = (unlinked || []).filter((r: any) =>
      normSym(r.symbol) === normSym(mp.symbol) && String(r.direction).toUpperCase() === String(mp.direction).toUpperCase());
  }
  if (!rows || rows.length === 0) {
    // Silence is how this bug hid for weeks — make a zero-match close loud.
    console.warn(`[close-mirror] master ticket ${mp.ticket} (${mp.symbol} ${mp.direction}) matched 0 open follower copies`);
    await db.from('notifications').insert({
      user_id: mp.master_user_id, type: 'CLOSE_MIRROR_WARNING',
      title: 'Follower copies not found for a closed Master trade',
      message: `Closing ${mp.symbol} ${mp.direction} (ticket ${mp.ticket}) matched no open follower copies — they may have failed to open or were already closed.`,
      data: jsonbSafe({ master_ticket: mp.ticket, symbol: mp.symbol, direction: mp.direction, link: '/journal' }),
    } as any);
    return { closed: 0, failed: 0, details: [], matched: 0 };
  }
  let closed = 0, failed = 0;
  const details: any[] = [];
  const signalIds: string[] = mp.signal_id ? [mp.signal_id] : [];
  for (const row of rows) {
    const { data: acc } = await db.from('trading_accounts').select('*').eq('id', row.trading_account_id).maybeSingle();
    const err = acc ? await closeOnAccount(acc, row.broker_ticket!, row.broker_symbol || row.symbol, Number(row.volume)) : 'Follower account missing';
    if (!err) {
      closed++;
      await db.from('trade_history').update({ status: 'closed', closed_at: new Date().toISOString(), close_reason: reason } as any).eq('id', row.id);
    } else {
      failed++;
      await db.from('trade_history').update({ comment: `Close mirror failed: ${err}`.slice(0, 500) } as any).eq('id', row.id);
    }
    if (row.signal_id) signalIds.push(row.signal_id);
    details.push({ account: acc?.name, ticket: row.broker_ticket, ok: !err, error: err });
  }
  await db.from('master_positions').update({ followers_closed: closed, followers_failed: failed } as any).eq('id', mp.id);
  // The Idea leaves the active feed once its trade is actually over.
  const uniqueSignalIds = [...new Set(signalIds)];
  if (uniqueSignalIds.length) {
    await db.from('trading_signals').update({ status: 'closed' } as any).in('id', uniqueSignalIds);
  }
  return { closed, failed, details, matched: rows.length };
}

function jsonbSafe(v: any) { return JSON.parse(JSON.stringify(v ?? null)); }

// Persistent ticket linking: runs on EVERY sync pass. Follower copies are
// placed seconds before the terminal watcher discovers the Master's ticket,
// so a one-time backfill at detection time always links nothing. Linking by
// signal when known, else by pair+direction when exactly one open Master
// position matches (never guess between two).
async function backfillTickets(acc: any) {
  const { data: rows } = await db.from('trade_history')
    .select('id, signal_id, symbol, direction')
    .eq('master_account_id', acc.id).eq('status', 'open').is('master_ticket', null)
    .not('broker_ticket', 'is', null).limit(100);
  if (!rows || rows.length === 0) return;
  const { data: mps } = await db.from('master_positions')
    .select('ticket, symbol, direction, signal_id').eq('master_account_id', acc.id).eq('status', 'open');
  if (!mps || mps.length === 0) return;
  for (const row of rows) {
    let mp = row.signal_id ? mps.find((m: any) => m.signal_id === row.signal_id) : null;
    if (!mp) {
      const matches = mps.filter((m: any) =>
        normSym(m.symbol) === normSym(row.symbol) && String(m.direction).toUpperCase() === String(row.direction).toUpperCase());
      if (matches.length !== 1) continue;
      mp = matches[0];
    }
    await db.from('trade_history').update({ master_ticket: mp.ticket } as any).eq('id', row.id);
  }
}

// mode "repair" (also runs automatically at the end of every cron pass):
// close orphaned follower copies — open copies whose Master position for the
// same pair+direction is CLOSED (their close event fired before matching
// worked, or the close mirror failed mid-way). Strictly gated: a copy is
// never touched unless (a) a master position for that pair actually exists,
// (b) it is closed, (c) the copy predates that close, and (d) it is at least
// 10 minutes old — so a just-copied trade can never be mistaken for an orphan.
async function repairAccount(acc: any) {
  const isVps = acc.connection_type === 'vps' || acc.provider === 'vps';
  if (isVps && await vpsBusy()) return { account: acc.name, skipped: 'terminal busy with a copy fan-out' };
  const { data: rows } = await db.from('trade_history')
    .select('id, trading_account_id, broker_ticket, broker_symbol, symbol, direction, volume, user_id, signal_id, master_ticket, created_at')
    .eq('master_account_id', acc.id).eq('status', 'open').not('broker_ticket', 'is', null).limit(100);
  if (!rows || rows.length === 0) return { account: acc.name, repaired: 0, failed: 0 };
  const { data: mps } = await db.from('master_positions')
    .select('ticket, symbol, direction, status, closed_at').eq('master_account_id', acc.id);
  const openTickets = new Set((mps || []).filter((m: any) => m.status === 'open').map((m: any) => String(m.ticket)));
  let repaired = 0, failed = 0;
  const details: any[] = [];
  const signalIds: string[] = [];
  for (const row of rows) {
    if (row.master_ticket && openTickets.has(String(row.master_ticket))) continue; // Master still holds this exact trade open
    const matches = (mps || []).filter((m: any) =>
      normSym(m.symbol) === normSym(row.symbol) && String(m.direction).toUpperCase() === String(row.direction).toUpperCase());
    if (matches.length === 0 || matches.some((m: any) => m.status === 'open')) continue;
    const lastClose = matches.map((m: any) => new Date(m.closed_at || 0).getTime()).reduce((a: number, b: number) => Math.max(a, b), 0);
    const copyAt = new Date(row.created_at || 0).getTime();
    if (Date.now() - copyAt < 10 * 60_000 || copyAt > lastClose) continue; // fresh copy, or master closed before this copy existed
    const { data: facc } = await db.from('trading_accounts').select('*').eq('id', row.trading_account_id).maybeSingle();
    const err = facc ? await closeOnAccount(facc, row.broker_ticket!, row.broker_symbol || row.symbol, Number(row.volume)) : 'Follower account missing';
    if (!err) {
      repaired++;
      if (row.signal_id) signalIds.push(row.signal_id);
      await db.from('trade_history').update({ status: 'closed', closed_at: new Date().toISOString(), close_reason: 'master_closed_repair' } as any).eq('id', row.id);
    } else {
      failed++;
      await db.from('trade_history').update({ comment: `Repair close failed: ${err}`.slice(0, 500) } as any).eq('id', row.id);
    }
    details.push({ account: facc?.name, ticket: row.broker_ticket, symbol: row.symbol, ok: !err, error: err });
  }
  if (signalIds.length) {
    await db.from('trading_signals').update({ status: 'closed' } as any).in('id', [...new Set(signalIds)]);
  }
  return { account: acc.name, repaired, failed, details };
}

async function vpsBusy(): Promise<boolean> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'vps_busy_until').maybeSingle();
  return !!data?.value && new Date(data.value).getTime() > Date.now();
}

const normSym = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FRX/, '').replace(/(M|PRO|MICRO|ECN|I|R)$/, '');

async function syncAccount(acc: any) {
  const isVps = acc.connection_type === 'vps' || acc.provider === 'vps';
  if (isVps && await vpsBusy()) return { account: acc.name, skipped: 'terminal busy with a copy fan-out' };
  // Keep follower copies linked to the Master's ticket on every pass —
  // this is what lets later closes find them.
  await backfillTickets(acc);
  const { positions, error } = await readPositions(acc);
  const now = new Date().toISOString();
  if (error || !positions) {
    await db.from('master_sync_state').upsert({ master_account_id: acc.id, last_error: error, last_sync_at: now } as any, { onConflict: 'master_account_id', ignoreDuplicates: false });
    return { account: acc.name, error };
  }
  const { data: state } = await db.from('master_sync_state').select('*').eq('master_account_id', acc.id).maybeSingle();
  const { data: openRows } = await db.from('master_positions').select('*').eq('master_account_id', acc.id).eq('status', 'open');
  const known = new Map((openRows || []).map((r: any) => [r.ticket, r]));
  const live = new Set(positions.map((p) => p.ticket));
  const firstRun = !state;
  const summary: any = { account: acc.name, live: positions.length, opened: [], closed: [] };

  for (const p of positions) {
    const row = known.get(p.ticket);
    if (row) {
      await db.from('master_positions').update({ current_profit: p.profit, volume: p.volume, last_seen_at: now } as any).eq('id', row.id);
      continue;
    }
    // New Master position.
    let signalId: string | null = null;
    let origin = firstRun ? 'baseline' : 'terminal';
    if (!firstRun) {
      const { data: mentor } = await db.from('mentor_profiles').select('id').eq('user_id', acc.user_id).maybeSingle();
      // Was it opened by publishing an Idea? Link to that signal (followers were already copied).
      if (mentor) {
        const { data: sigs } = await db.from('trading_signals').select('id, symbol, direction, created_at')
          .eq('mentor_id', mentor.id).gte('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
          .order('created_at', { ascending: false });
        const match = (sigs || []).find((s: any) => normSym(s.symbol) === normSym(p.symbol) && String(s.direction).toUpperCase() === p.direction);
        if (match) { signalId = match.id; origin = 'idea'; }
      }
      const { data: inserted } = await db.from('master_positions').insert({
        master_account_id: acc.id, master_user_id: acc.user_id, ticket: p.ticket, symbol: p.symbol, direction: p.direction,
        volume: p.volume, open_price: p.open_price, current_profit: p.profit, signal_id: signalId, origin, opened_at: p.opened_at,
      } as any).select('id').maybeSingle();
      if (!inserted) continue; // race with another sync — already recorded
      if (signalId) {
        await db.from('trade_history').update({ master_ticket: p.ticket } as any)
          .eq('signal_id', signalId).eq('master_account_id', acc.id).is('master_ticket', null);
      } else if (mentor) {
        // Opened directly in MT5 (mobile / VPS terminal): publish it as an Idea
        // and copy it to followers, tagged with the Master ticket for close mirroring.
        const { data: sig } = await db.from('trading_signals').insert({
          symbol: normSym(p.symbol) || p.symbol, direction: p.direction, lot_size: p.volume || 0.01,
          stop_loss: p.sl || null, take_profit: p.tp || null, mentor_id: mentor.id, status: 'active',
          comment: `Mirrored from MT5 terminal [#${p.ticket}]`, auto_to_copyfactory: true, auto_to_ai_bot: false,
        } as any).select('id').single();
        if (sig) {
          await db.from('master_positions').update({ signal_id: sig.id } as any).eq('id', inserted.id);
          const task = db.functions.invoke('copy-trade-listener', { body: { signal_id: sig.id, master_user_id: acc.user_id } })
            .catch((e) => console.error('fan-out invoke failed', e));
          // @ts-ignore EdgeRuntime exists in Supabase edge runtime
          (globalThis as any).EdgeRuntime?.waitUntil?.(task);
        }
      }
    } else {
      await db.from('master_positions').insert({
        master_account_id: acc.id, master_user_id: acc.user_id, ticket: p.ticket, symbol: p.symbol, direction: p.direction,
        volume: p.volume, open_price: p.open_price, current_profit: p.profit, origin, opened_at: p.opened_at,
      } as any);
    }
    summary.opened.push({ ticket: p.ticket, symbol: p.symbol, origin, signalId });
  }

  for (const [ticket, row] of known) {
    if (live.has(ticket)) continue;
    // Closed on the Master side (manual close on MT5, SL or TP).
    const { data: claimed } = await db.from('master_positions')
      .update({ status: 'closed', closed_at: now, close_source: 'terminal' } as any)
      .eq('id', (row as any).id).eq('status', 'open').select('*').maybeSingle();
    if (!claimed) continue;
    const res = await closeFollowers(claimed, 'master_closed_terminal');
    summary.closed.push({ ticket, symbol: (row as any).symbol, ...res });
  }

  await db.from('master_sync_state').upsert({ master_account_id: acc.id, last_error: null, last_sync_at: now, ...(firstRun ? { baselined_at: now } : {}) } as any, { onConflict: 'master_account_id' });
  return summary;
}

async function authedUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const c = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data } = await c.auth.getUser();
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || 'cron');

    if (mode === 'cron') {
      const passes = Math.min(Number(body?.passes) || 3, 4);
      const out: any[] = [];
      for (let i = 0; i < passes; i++) {
        const { data: masters } = await db.from('trading_accounts').select('*').eq('is_master', true);
        for (const m of masters || []) out.push(await syncAccount(m).catch((e) => ({ account: m.name, error: String(e) })));
        if (i < passes - 1) await new Promise((r) => setTimeout(r, 15000));
      }
      return json({ success: true, results: out });
    }

    const user = await authedUser(req);
    if (!user) return json({ error: 'Sign in required' }, 401);
    const accountId = String(body?.account_id || '');
    const { data: acc } = accountId
      ? await db.from('trading_accounts').select('*').eq('id', accountId).maybeSingle()
      : { data: null };
    if (mode !== 'repair' && (!acc || acc.user_id !== user.id || !acc.is_master)) {
      return json({ error: 'Master account not found for this user' }, 403);
    }

    if (mode === 'sync') return json({ success: true, result: await syncAccount(acc) });

    if (mode === 'repair') {
      const isAdmin = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1).then((r) => !!r.data?.length);
      let targets: any[];
      if (body?.account_id) {
        if (acc.user_id !== user.id && !isAdmin) return json({ error: 'Not allowed for this account' }, 403);
        targets = [acc];
      } else {
        if (!isAdmin) return json({ error: 'Admin required to repair all master accounts' }, 403);
        const { data: masters } = await db.from('trading_accounts').select('*').eq('is_master', true);
        targets = masters || [];
      }
      const out: any[] = [];
      for (const t of targets) out.push(await repairAccount(t).catch((e) => ({ account: t.name, error: String(e) })));
      return json({ success: true, results: out });
    }

    if (mode === 'close') {
      const ticket = String(body?.ticket || '');
      const { data: mp } = await db.from('master_positions').select('*').eq('master_account_id', acc.id).eq('ticket', ticket).eq('status', 'open').maybeSingle();
      if (!mp) return json({ error: 'This trade is no longer open' }, 404);
      if ((acc.connection_type === 'vps' || acc.provider === 'vps') && await vpsBusy()) {
        return json({ error: 'Copying is in progress on the trading terminal — try again in a few seconds' }, 409);
      }
      const err = await closeOnAccount(acc, ticket, mp.symbol, Number(mp.volume));
      if (err) return json({ success: false, error: `Master trade not closed: ${err}` }, 502);
      const { data: claimed } = await db.from('master_positions').update({ status: 'closed', closed_at: new Date().toISOString(), close_source: 'humi' } as any)
        .eq('id', mp.id).eq('status', 'open').select('*').maybeSingle();
      const res = claimed ? await closeFollowers(claimed, 'master_closed_humi') : { closed: 0, failed: 0, details: [] };
      if (acc.connection_type === 'vps' || acc.provider === 'vps') await bindVps(acc); // park terminal back on the Master
      return json({ success: true, master_closed: true, followers: res });
    }

    return json({ error: `Unknown mode ${mode}` }, 400);
  } catch (e: any) {
    console.error('master-position-sync error', e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
