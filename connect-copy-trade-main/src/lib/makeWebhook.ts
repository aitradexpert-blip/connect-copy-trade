export type MakeNewSignalPayload = {
  event: "new_signal";
  symbol: string;
  direction: string;
  sl: number | null;
  tp: number | null;
  comment: string | null;
};

export async function notifyMakeNewSignal(payload: Omit<MakeNewSignalPayload, "event">): Promise<void> {
  const url = import.meta.env.VITE_MAKE_SIGNAL_WEBHOOK_URL?.trim();
  if (!url) {
    console.warn("[makeWebhook] VITE_MAKE_SIGNAL_WEBHOOK_URL is not set; skipping.");
    return;
  }

  const body: MakeNewSignalPayload = {
    event: "new_signal",
    ...payload,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Make.com webhook failed (${res.status})`);
  }
}
