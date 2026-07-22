import { useEffect, useRef } from "react";

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

  useEffect(() => {
    rendered.current = false;
    let cancelled = false;
    loadPayPalSdk().then(() => {
      if (cancelled || rendered.current || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      (window as any).paypal
        .HostedButtons({ hostedButtonId })
        .render(containerRef.current);
      rendered.current = true;
    });
    return () => { cancelled = true; };
  }, [hostedButtonId]);

  return <div ref={containerRef} id={`paypal-container-${hostedButtonId}`} />;
}
