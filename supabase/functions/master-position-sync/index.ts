// Master position lifecycle mirroring.
//  - mode "cron"  : (pg_cron, every minute) watch every Master account's live
//                   MT5 positions; mirror new terminal trades to followers and
//                   mirror closes (from MT5 mobile / VPS terminal / SL / TP).
//  - mode "sync"  : same, for one account the caller owns (instant refresh).
//  - mode "close" : Master pressed "Close Trade" in HuMi — close the Master's
//                   position first, then every follower copy of it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { chooseCloseIdeaStrategy, isOpenCopyRow } from './closeIdeaRules.ts';

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

async function closeOnAccount(
  acc: any,
  ticket: string,
  symbol: string,
  volume: number,
  result?: { retcode?: number | string; comment?: string },
): Promise<string | null> {
  if (acc.connection_type === 'vps' || acc.provider === 'vps') {
    const bindErr = await bindVps(acc);
    if (bindErr) return bindErr;
    const r = await vps('POST', '/close', { accountId: acc.id, account_id: acc.id, ticket: Number(ticket), symbol, volume }, 20000);
    if (r.status === 404 || r.status === 405) return 'Trading bridge has no /close endpoint yet — install the close update on the VPS';
    const d = r.json?.data ?? r.json;
    if (result) {
      result.retcode = d?.retcode ?? d?.retCode;
      result.comment = d?.comment ?? r.json?.message;
    }
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
    if (result) {
      result.retcode = j?.numericCode ?? j?.stringCode;
      result.comment = j?.message;
    }
    if (r.ok && (j?.numericCode === 0 || j?.numericCode === 10009 || j?.stringCode === 'TRADE_RETCODE_DONE' || !j?.error)) return null;
    if (/not\s+found/i.test(JSON.stringify(j))) return null;
    return j?.message || j?.error || `MetaAPI close HTTP ${r.status}`;
  }
  return 'No live connection for this account';
}

async function closeVerifiedPosition(acc: any, ticket: string, symbol: string) {
  const isVps = acc.connection_type === 'vps' || acc.provider === 'vps';
  if (isVps && await vpsBusy()) return { error: 'Trading terminal is busy; try again shortly', position: null, broker: {} };
  if (isVps) await setVpsBusyUntil(new Date(Date.now() + 90_000));
  try {
    const before = await readPositions(acc);
    if (before.error || !before.positions) {
      return { error: `Broker audit failed: ${before.error || 'could not read positions'}; no close order was sent`, position: null, broker: {} };
    }
    const live = before.positions.find((position) => String(position.ticket) === String(ticket));
    if (!live) return { error: 'Ticket is not currently open at the broker; no close order was sent', position: null, broker: {} };

    const broker: { retcode?: number | string; comment?: string } = {};
    const closeError = await closeOnAccount(acc, String(ticket), symbol || live.symbol, Number(live.volume), broker);
    if (closeError) return { error: closeError, position: live, broker };

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 750));
      const after = await readPositions(acc);
      if (after.error || !after.positions) {
        return { error: `Broker accepted close but post-close verification failed: ${after.error || 'could not read positions'}`, position: live, broker };
      }
      if (!after.positions.some((position) => String(position.ticket) === String(ticket))) {
        return { error: null, position: live, broker };
      }
    }
    return { error: 'Broker accepted the request, but the ticket is still open; the record was left unchanged', position: live, broker };
  } finally {
    if (isVps) await setVpsBusyUntil(null);
  }
}

async function closeMasterPosition(acc: any, mp: any, reason: string) {
  const close = await closeVerifiedPosition(acc, String(mp.ticket), mp.symbol);
  if (close.error === 'Ticket is not currently open at the broker; no close order was sent') {
    const { data: alreadyClosed, error: markError } = await db.from('master_positions')
      .update({ status: 'closed', closed_at: new Date().toISOString(), close_source: 'terminal' } as any)
      .eq('id', mp.id).eq('status', 'open').select('*').maybeSingle();
    if (markError) return { success: false, error: `Master ticket is already absent at the broker; position record update failed: ${markError.message}` };
    if (!alreadyClosed) return { success: false, error: 'Master position changed while closing; refresh before retrying' };
    return { success: true, master_closed: true, already_closed_at_broker: true, followers: await closeFollowers(alreadyClosed, reason) };
  }
  if (close.error) return { success: false, error: `Master trade not closed: ${close.error}` };
  const { data: claimed, error: updateError } = await db.from('master_positions')
    .update({ status: 'closed', closed_at: new Date().toISOString(), close_source: reason === 'mentor_close_idea' ? 'humi' : reason } as any)
    .eq('id', mp.id).eq('status', 'open').select('*').maybeSingle();
  if (updateError) return { success: false, error: `Broker closed; Master record update failed: ${updateError.message}` };
  if (!claimed) return { success: false, error: 'Master position changed while closing; refresh and retry if copies remain open' };
  const followers = await closeFollowers(claimed, reason);
  return { success: true, master_closed: true, followers };
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
  const selectCols = 'id, trading_account_id, broker_ticket, broker_symbol, symbol, direction, volume, user_id, signal_id, created_at';
  let { data: rows } = await db.from('trade_history')
    .select(selectCols)
    .eq('master_account_id', mp.master_account_id).eq('status', 'open').not('broker_ticket', 'is', null)
    .or(filters.join(','));
  if (!rows || rows.length === 0) {
    // Fallback: unlinked open copies of the same pair + direction on this
    // master. Restricted to copies created in a short window around the
    // Master's own open — older unlinked copies of the same pair belong to
    // other trades and must never be swept into this close.
    const openAt = mp.opened_at || mp.first_seen_at || null;
    const openMs = openAt ? new Date(openAt).getTime() : 0;
    const { data: unlinked } = await db.from('trade_history')
      .select(selectCols)
      .eq('master_account_id', mp.master_account_id).eq('status', 'open')
      .not('broker_ticket', 'is', null).is('master_ticket', null);
    rows = (unlinked || []).filter((r: any) =>
      openMs > 0
      && normSym(r.symbol) === normSym(mp.symbol)
      && String(r.direction).toUpperCase() === String(mp.direction).toUpperCase()
      && new Date(r.created_at).getTime() >= openMs - 60_000
      && new Date(r.created_at).getTime() <= openMs + 2 * 60_000);
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
  const accountIds = [...new Set(rows.map((row: any) => row.trading_account_id))];
  const { data: accounts } = await db.from('trading_accounts').select('*').in('id', accountIds);
  const accountMap = new Map((accounts || []).map((account: any) => [account.id, account]));
  const vpsRows = rows.filter((row: any) => {
    const account = accountMap.get(row.trading_account_id);
    return account?.connection_type === 'vps' || account?.provider === 'vps';
  }).length;
  if (vpsRows && await vpsBusy()) {
    const details = rows.map((row: any) => ({ account: accountMap.get(row.trading_account_id)?.name, ticket: row.broker_ticket, ok: false, error: 'Trading terminal is busy; retry this close shortly' }));
    return { closed: 0, failed: rows.length, details, matched: rows.length };
  }
  if (vpsRows) await setVpsBusyUntil(new Date(Date.now() + vpsRows * 25_000 + 60_000));
  let closed = 0, failed = 0;
  const details: any[] = [];
  const signalIds: string[] = mp.signal_id ? [mp.signal_id] : [];
  try {
    for (const row of rows) {
      const acc = accountMap.get(row.trading_account_id);
      const err = acc ? await closeOnAccount(acc, row.broker_ticket!, row.broker_symbol || row.symbol, Number(row.volume)) : 'Follower account missing';
      if (!err) {
        closed++;
        await db.from('trade_history').update({ status: 'closed', closed_at: new Date().toISOString(), close_reason: reason } as any).eq('id', row.id).eq('status', 'open');
      } else {
        failed++;
        await db.from('trade_history').update({ comment: `Close mirror failed: ${err}`.slice(0, 500) } as any).eq('id', row.id).eq('status', 'open');
      }
      if (row.signal_id) signalIds.push(row.signal_id);
      details.push({ account: acc?.name, ticket: row.broker_ticket, ok: !err, error: err });
    }
  } finally {
    if (vpsRows) await setVpsBusyUntil(null);
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

const setVpsBusyUntil = async (until: Date | null) => {
  try {
    await db.from('app_settings').upsert({
      key: 'vps_busy_until', value: until ? until.toISOString() : new Date(0).toISOString(), updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });
  } catch (e) { console.warn('vps_busy flag failed', e); }
};

// Reconcile pass: every Master position closed within the lookback window
// (default 24h) still gets its open follower copies closed — this repairs
// closes that happened before ticket linking / windowed matching existed.
// Idempotent: a position with nothing left open is a cheap DB no-op, and a
// copy is only ever marked closed after the broker itself confirms the close
// (or reports the position already gone). Nothing is bulk-marked.
async function reconcileCloses(opts: { hours?: number } = {}) {
  const hours = Math.min(Math.max(Number(opts.hours) || 24, 1), 240);
  if (await vpsBusy()) return { skipped: 'terminal busy with a copy fan-out' };
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data: mps } = await db.from('master_positions')
    .select('*').eq('status', 'closed').gte('closed_at', since).order('closed_at', { ascending: false });
  const results: any[] = [];
  for (const mp of mps || []) {
    if (await vpsBusy()) { results.push({ ticket: mp.ticket, symbol: mp.symbol, skipped: 'terminal busy' }); continue; }
    // Cheap candidate check FIRST — never call the broker for a position
    // whose copies are already all closed.
    const openAt = mp.opened_at || mp.first_seen_at || null;
    const openMs = openAt ? new Date(openAt).getTime() : 0;
    const { data: linked } = await db.from('trade_history').select('id')
      .eq('master_account_id', mp.master_account_id).eq('status', 'open')
      .not('broker_ticket', 'is', null).eq('master_ticket', String(mp.ticket));
    let candidates = linked || [];
    if (!candidates.length) {
      const { data: unlinked } = await db.from('trade_history')
        .select('id, symbol, direction, created_at')
        .eq('master_account_id', mp.master_account_id).eq('status', 'open')
        .not('broker_ticket', 'is', null).is('master_ticket', null);
      candidates = (unlinked || []).filter((r: any) =>
        openMs > 0
        && normSym(r.symbol) === normSym(mp.symbol)
        && String(r.direction).toUpperCase() === String(mp.direction).toUpperCase()
        && new Date(r.created_at).getTime() >= openMs - 60_000
        && new Date(r.created_at).getTime() <= openMs + 2 * 60_000);
    }
    if (!candidates.length) continue;
    const res = await closeFollowers(mp, 'master_closed_reconcile');
    results.push({ ticket: mp.ticket, symbol: mp.symbol, direction: mp.direction, master_closed_at: mp.closed_at, ...res });
  }
  return { hours, reconciled: results.length, results };
}

// Read-only audit: for every open follower copy, ask the broker for its REAL
// live positions and report which copies are truly still open. Writes NO
// status changes — the report decides what happens next.
async function auditOpenCopies(opts: { master_account_id?: string; trade_ids?: string[]; hours?: number } = {}) {
  const hours = Math.min(Math.max(Number(opts.hours) || 24 * 30, 1), 24 * 365);
  if (await vpsBusy()) return { skipped: 'terminal busy with a copy fan-out' };
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  let q = db.from('trade_history')
    .select('id, trading_account_id, broker_ticket, broker_symbol, symbol, direction, volume, created_at, master_ticket, signal_id')
    .eq('status', 'open').not('broker_ticket', 'is', null)
    .gte('created_at', since).order('created_at', { ascending: false }).limit(300);
  if (opts.master_account_id) q = q.eq('master_account_id', opts.master_account_id);
  if (opts.trade_ids?.length) q = q.in('id', opts.trade_ids);
  const { data: rows, error } = await q;
  if (error) return { error: error.message };
  if (!rows?.length) return { checked: 0, entries: [] };
  const accIds = [...new Set(rows.map((r: any) => r.trading_account_id))];
  const { data: accs } = await db.from('trading_accounts')
    .select('id, name, login, server, connection_type, provider, metaapi_account_id, mt5_password, connection_status')
    .in('id', accIds);
  const accMap = new Map((accs || []).map((a: any) => [a.id, a]));
  const byAcc = new Map<string, any[]>();
  for (const r of rows) {
    const list = byAcc.get(r.trading_account_id) || [];
    list.push(r);
    byAcc.set(r.trading_account_id, list);
  }
  // Park the cron watcher while the shared terminal is bound account-by-account.
  await setVpsBusyUntil(new Date(Date.now() + byAcc.size * 25_000 + 60_000));
  const entries: any[] = [];
  try {
    for (const [accId, rs] of byAcc) {
      const acc = accMap.get(accId);
      if (!acc) {
        for (const r of rs) entries.push({ ticket: r.broker_ticket, symbol: r.symbol, direction: r.direction, account: null, created_at: r.created_at, verdict: 'account_missing' });
        continue;
      }
      const { positions, error: perr } = await readPositions(acc);
      if (perr || !positions) {
        for (const r of rs) entries.push({ ticket: r.broker_ticket, symbol: r.symbol, direction: r.direction, account: acc.name, created_at: r.created_at, verdict: 'check_failed', error: perr });
        continue;
      }
      const liveByTicket = new Map(positions.map((p) => [String(p.ticket), p]));
      for (const r of rs) {
        const live = liveByTicket.get(String(r.broker_ticket));
        entries.push({
          trade_id: r.id, ticket: r.broker_ticket, symbol: r.symbol, broker_symbol: r.broker_symbol,
          direction: r.direction, recorded_volume: r.volume, broker_volume: live?.volume ?? null,
          account: acc.name, created_at: r.created_at, master_ticket: r.master_ticket,
          verdict: live ? 'truly_open' : 'not_on_broker',
        });
      }
    }
  } finally {
    await setVpsBusyUntil(null);
  }
  return { checked: rows.length, accounts: byAcc.size, entries };
}

async function vpsBusy(): Promise<boolean> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'vps_busy_until').maybeSingle();
  return !!data?.value && new Date(data.value).getTime() > Date.now();
}

async function closeIdeaFollowersOnly(signalId: string, ownerUserId: string) {
  const { data: ownerMasterAccounts } = await db.from('trading_accounts').select('id')
    .eq('user_id', ownerUserId).eq('is_master', true);
  const masterAccountIds = (ownerMasterAccounts || []).map((account: any) => account.id);
  if (!masterAccountIds.length) return { closed: 0, failed: 0, details: [], matched: 0 };
  const { data: rows, error } = await db.from('trade_history')
    .select('id, user_id, trading_account_id, master_account_id, broker_ticket, broker_symbol, symbol, direction, volume, status')
    .eq('signal_id', signalId).eq('status', 'open')
    .in('master_account_id', masterAccountIds);
  if (error) return { closed: 0, failed: 0, details: [{ ok: false, error: error.message }] };

  const candidates = (rows || []).filter((row: any) => row.status === 'open');
  let closed = 0;
  let failed = 0;
  const details: any[] = [];
  for (const row of candidates) {
    if (!isOpenCopyRow(row)) {
      failed++;
      details.push({ trade_id: row.id, ok: false, error: 'No broker ticket is recorded for this open copy' });
      continue;
    }
    const { data: acc } = await db.from('trading_accounts').select('*').eq('id', row.trading_account_id).maybeSingle();
    if (!acc || acc.user_id !== row.user_id || acc.is_master || acc.id === row.master_account_id) {
      failed++;
      details.push({ trade_id: row.id, account: acc?.name, ok: false, error: acc ? 'Skipped non-follower or Master account; only follower accounts are closed on this path' : 'Follower account missing' });
      continue;
    }
    const result = await closeVerifiedPosition(acc, String(row.broker_ticket), row.broker_symbol || row.symbol);
    if (result.error) {
      failed++;
      details.push({ trade_id: row.id, account: acc.name, ticket: row.broker_ticket, ok: false, error: result.error, broker: result.broker });
      continue;
    }
    const { error: updateError } = await db.from('trade_history').update({
      status: 'closed', closed_at: new Date().toISOString(), close_reason: 'mentor_close_idea',
    } as any).eq('id', row.id).eq('status', 'open');
    if (updateError) {
      failed++;
      details.push({ trade_id: row.id, account: acc.name, ticket: row.broker_ticket, ok: false, error: `Broker closed; app record update failed: ${updateError.message}` });
      continue;
    }
    closed++;
    details.push({ trade_id: row.id, account: acc.name, ticket: row.broker_ticket, volume: result.position?.volume, ok: true, broker: result.broker });
  }
  return { closed, failed, details, matched: candidates.length };
}

// Strip broker suffixes (EURUSDm, EURUSD.pro, EURUSDECN...) but NEVER bare
// single trailing letters: USDZAR ends in R (South African Rand) and stripping
// it produced the phantom "USDZA" symbol that broke matching and fan-out.
const normSym = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FRX/, '').replace(/(PRO|MICRO|ECN|M)$/, '');

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
          const task = db.functions.invoke('copy-trade-listener', {
            body: { signal_id: sig.id, master_user_id: acc.user_id, master_ticket: p.ticket, master_account_id: acc.id },
          })
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

async function closeIdea(signalId: string, userId: string) {
  if (!signalId || signalId.length > 80) return { status: 400, body: { error: 'A valid idea id is required' } };
  const { data: signal, error: signalError } = await db.from('trading_signals')
    .select('id, mentor_id, status').eq('id', signalId).maybeSingle();
  if (signalError || !signal) return { status: 404, body: { error: 'Idea not found' } };
  if (!signal.mentor_id) return { status: 403, body: { error: 'Only the owning mentor can close this Idea' } };
  const { data: mentor } = await db.from('mentor_profiles').select('user_id').eq('id', signal.mentor_id).maybeSingle();
  if (mentor?.user_id !== userId) return { status: 403, body: { error: 'Only the owning mentor can close this Idea' } };

  const { data: openPositions, error: positionError } = await db.from('master_positions')
    .select('*').eq('signal_id', signalId).eq('status', 'open').order('first_seen_at', { ascending: true });
  if (positionError) return { status: 500, body: { error: positionError.message } };
  const strategy = chooseCloseIdeaStrategy(true, openPositions?.length || 0);
  if (strategy === 'close_master_and_followers') {
    const results: any[] = [];
    for (const mp of openPositions || []) {
      const { data: acc } = await db.from('trading_accounts').select('*').eq('id', mp.master_account_id).maybeSingle();
      if (!acc || acc.user_id !== userId || !acc.is_master) {
        results.push({ ticket: mp.ticket, success: false, error: 'Linked Master account could not be verified as yours' });
        continue;
      }
      const result = await closeMasterPosition(acc, mp, 'mentor_close_idea');
      results.push({ ticket: mp.ticket, symbol: mp.symbol, ...result });
      if (acc.connection_type === 'vps' || acc.provider === 'vps') await bindVps(acc);
    }
    const followers = results.reduce((sum, result) => sum + (result.followers?.closed || 0), 0);
    const failed = results.reduce((sum, result) => sum + (result.followers?.failed || (result.success ? 0 : 1)), 0);
    return { status: 200, body: { success: true, strategy, master_positions: results, followers: { closed: followers, failed, details: results.flatMap((result) => result.followers?.details || []) } } };
  }

  const followers = await closeIdeaFollowersOnly(signalId, userId);
  if (!followers.failed) {
    const { count, error: countError } = await db.from('trade_history').select('id', { count: 'exact', head: true })
      .eq('signal_id', signalId).eq('status', 'open');
    if (!countError && count === 0) await db.from('trading_signals').update({ status: 'closed' } as any).eq('id', signalId).neq('status', 'removed');
  }
  return { status: 200, body: { success: true, strategy, followers } };
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
    if (mode === 'close_idea') {
      const result = await closeIdea(String(body?.signal_id || ''), user.id);
      return json(result.body, result.status);
    }
    if (mode === 'audit') {
      const tradeIds = Array.isArray(body?.trade_ids) ? body.trade_ids.map(String).slice(0, 50) : [];
      if (!tradeIds.length) return json({ error: 'trade_ids must contain at least one trade id' }, 400);
      const { data: rows, error } = await db.from('trade_history').select('id, master_account_id').in('id', tradeIds);
      if (error) return json({ error: error.message }, 500);
      if (!rows?.length || rows.length !== new Set(tradeIds).size) return json({ error: 'One or more trade records were not found' }, 404);
      const masterIds = [...new Set(rows.map((row: any) => row.master_account_id).filter(Boolean))];
      const { data: masters } = await db.from('trading_accounts').select('id, user_id').in('id', masterIds);
      const isAdmin = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1).then((r) => !!r.data?.length);
      if (masters?.length !== masterIds.length || (!isAdmin && (masters || []).some((master: any) => master.user_id !== user.id))) {
        return json({ error: 'Only the Master account owner can audit these trades' }, 403);
      }
      return json({ success: true, ...(await auditOpenCopies({ trade_ids: tradeIds })) });
    }
    if (mode === 'close_copy') {
      const tradeId = String(body?.trade_id || '');
      if (!tradeId || tradeId.length > 80) return json({ error: 'A valid trade id is required' }, 400);
      const { data: row, error: rowError } = await db.from('trade_history')
        .select('id, user_id, trading_account_id, master_account_id, broker_ticket, broker_symbol, symbol, direction, volume, status')
        .eq('id', tradeId).maybeSingle();
      if (rowError || !row) return json({ error: 'Follower trade not found' }, 404);
      if (row.status !== 'open') return json({ success: true, skipped: 'already_closed', trade_id: row.id });
      if (!row.master_account_id || row.user_id === user.id || row.trading_account_id === row.master_account_id) {
        return json({ error: 'This row is not an eligible follower copy' }, 403);
      }
      const { data: master } = await db.from('trading_accounts').select('id, user_id, is_master')
        .eq('id', row.master_account_id).maybeSingle();
      const isAdmin = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1).then((r) => !!r.data?.length);
      if ((!master || master.user_id !== user.id || !master.is_master) && !isAdmin) {
        return json({ error: 'Only the Master account owner can close this follower copy' }, 403);
      }
      if (!row.broker_ticket) return json({ error: 'No broker ticket is recorded; no close order was sent' }, 409);
      const { data: follower } = await db.from('trading_accounts').select('*').eq('id', row.trading_account_id).maybeSingle();
      if (!follower || follower.user_id !== row.user_id || follower.is_master || follower.id === row.master_account_id) {
        return json({ error: 'Follower account ownership could not be verified; Master accounts are never closed on this path' }, 409);
      }
      const close = await closeVerifiedPosition(follower, String(row.broker_ticket), row.broker_symbol || row.symbol);
      if (close.error) {
        const notOpen = close.error.includes('not currently open at the broker');
        return json({ success: notOpen, ...(notOpen ? { skipped: 'not_on_broker', record_unchanged: true } : {}), error: close.error, ticket: row.broker_ticket, broker: close.broker }, notOpen ? 200 : 502);
      }
      const { error: updateError } = await db.from('trade_history').update({
        status: 'closed', closed_at: new Date().toISOString(), close_reason: 'verified_manual_close',
      } as any).eq('id', row.id).eq('status', 'open');
      if (updateError) return json({ success: false, error: `Broker closed and verified; HuMi record update failed: ${updateError.message}`, ticket: row.broker_ticket, broker: close.broker }, 500);
      return json({ success: true, closed: true, trade_id: row.id, account: follower.name, ticket: row.broker_ticket, symbol: close.position?.symbol, volume: close.position?.volume, broker: close.broker });
    }
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
      const res = await closeMasterPosition(acc, mp, 'master_closed_humi');
      if (!res.success) return json({ success: false, error: res.error }, 502);
      if (acc.connection_type === 'vps' || acc.provider === 'vps') await bindVps(acc); // park terminal back on the Master
      return json(res);
    }

    return json({ error: `Unknown mode ${mode}` }, 400);
  } catch (e: any) {
    console.error('master-position-sync error', e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
