import { useEffect, useRef, useState } from "react";

const PAYPAL_SDK_URL = "https://www.paypal.com/sdk/js?client-id=BAASmVd6B_nXV69-3ONd-qFJjbXLvo41o_FXz3xaSG3_6jgsPojmkDZiiO8n39UoIdwhhzqxHWowv2UPJQ&components=hosted-buttons&disable-funding=venmo&currency=USD";

let sdkLoadPromise: Promise<void> | null = null;
function loadPayPalSdk(): Promise<void> {
  if ((window as any).paypal) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PAYPAL_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

interface PayPalHostedButtonProps {
  hostedButtonId: string;
}

export function PayPalHostedButton({ hostedButtonId }: PayPalHostedButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rendered.current = false;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadPayPalSdk()
      .then(() => {
        if (cancelled || rendered.current || !containerRef.current) return;
        try {
          containerRef.current.innerHTML = "";
          (window as any).paypal.HostedButtons({ hostedButtonId }).render(containerRef.current);
          rendered.current = true;
        } catch (err: any) {
          setError("Failed to render PayPal button");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load PayPal SDK");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [hostedButtonId]);

  return (
    <div className="min-h-[55px] flex items-center justify-center">
      {loading && !error && <div className="text-sm text-muted-foreground">Loading PayPal…</div>}
      {error && <div className="text-sm text-destructive">PayPal unavailable — please scan the QR code to pay or try again later.</div>}
      <div ref={containerRef} id={`paypal-container-${hostedButtonId}`} className="w-full" />
    </div>
  );
}
