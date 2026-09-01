# Honest publish-result toasts

## Current code (verbatim)

All publish paths funnel through `src/services/publishFanOut.ts`, except the admin one which aggregates summaries itself.

`src/services/publishFanOut.ts` — builds a single representative error:

```ts
summary.firstError =
  summary.results.find((r: any) => r && r.success === false)?.error ?? null;
```

and then in `describeFanOut`:

```ts
if (summary.copied === 0) {
  return {
    title: `Published, but 0 of ${summary.followers} followers filled`,
    description: summary.firstError || "All follower executions were rejected.",
    destructive: true,
  };
}

return {
  title: `Published — copied to ${summary.copied} of ${summary.followers} followers`,
  description:
    summary.failed > 0
      ? `${summary.failed} failed: ${summary.firstError || "see console for details"}`
      : "All follower accounts filled automatically.",
  destructive: false,
};
```

Consumers that just render `report.title` / `report.description`:
- `src/pages/MentorHub.tsx` (lines ~291-297, ~391-397, ~651-657, ~684-690)
- `src/pages/MentorCenter.tsx` (lines ~358-364, ~451-457)
- `src/pages/TradingIdeas.tsx` (lines ~202-208)

`src/pages/Admin.tsx` (lines ~136-145) builds its own note, also from `firstError` only:

```ts
for (const s of summaries) {
  totalCopied += s.copied;
  totalFailed += s.failed;
  if (s.firstError) fanOutErrors.push(s.firstError);
}
const fanOutNote = newSignal
  ? ` Copy fan-out: ${totalCopied} copied, ${totalFailed} failed${fanOutErrors.length ? ` — ${[...new Set(fanOutErrors)].slice(0, 2).join('; ')}` : ''}.`
  : '';
```

So when 10 followers fail for different reasons, only the first one's message is shown.

## The fix (presentation layer only)

### 1. `src/services/publishFanOut.ts`
- Add an error classifier that maps a raw follower error string to a short bucket label:
  - timeout / aborted / unreachable bridge -> "timed out"
  - invalid credentials / password -> "need a password update"
  - not deployed / deploying / redeploy -> "still deploying"
  - symbol not available / invalid symbol -> "symbol unavailable on broker"
  - no account / orphan rows -> "no linked account"
  - anything else -> the raw message, trimmed
- Add `errorGroups: { label: string; count: number; sample: string }[]` to `FanOutSummary`, built by tallying **every** failed entry in `results` (keep `firstError` for backwards compatibility).
- Add exported `formatErrorGroups(groups, total)` returning e.g. `6 timed out, 3 still deploying, 1 needs a password update`; single-group case renders just that one reason (with its raw message so no detail is lost); cap at the top 3 groups plus `+N other` when there are more.
- Use it in `describeFanOut` for both the "0 filled" and "partial failure" branches.

### 2. `src/pages/Admin.tsx`
- Merge the per-master `errorGroups` into one tally instead of pushing `firstError`, and build `fanOutNote` from `formatErrorGroups`.

### 3. Untouched
- `supabase/functions/copy-trade-listener/index.ts` execution/retry logic.
- MentorHub / MentorCenter / TradingIdeas call sites — they already just render the report and pick up the improvement automatically.

## Verification
Full-project typecheck (`tsconfig.app.json`) must pass clean.
