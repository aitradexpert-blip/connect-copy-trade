import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// VAPID public key must be exposed to the client. Set VITE_VAPID_PUBLIC_KEY
// in .env from the same VAPID_PUBLIC_KEY stored as an edge-function secret.
const ENV_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
let cachedKey: string | undefined = ENV_VAPID_KEY;

async function getVapidPublicKey(): Promise<string | undefined> {
  if (cachedKey) return cachedKey;
  try {
    const { data } = await supabase.functions.invoke('send-push-notification', { method: 'GET' });
    if (data?.publicKey) cachedKey = String(data.publicKey);
  } catch (e) {
    console.warn('Could not load push key', e);
  }
  return cachedKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
    if (ok) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  const enable = useCallback(async () => {
    if (!supported || !user) return { ok: false, error: 'Not supported' };
    setLoading(true);
    try {
      const VAPID_PUBLIC_KEY = await getVapidPublicKey();
      if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'Push is not configured on the server yet' };
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return { ok: false, error: 'Permission denied' };

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
        });
      }
      const json: any = sub.toJSON();

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh || '',
          auth: json.keys?.auth || '',
          user_agent: navigator.userAgent,
        }, { onConflict: 'user_id,endpoint' });

      if (error) return { ok: false, error: error.message };
      setSubscribed(true);
      return { ok: true };
    } finally {
      setLoading(false);
    }
  }, [supported, user]);

  const disable = useCallback(async () => {
    if (!supported || !user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete()
          .eq('user_id', user.id).eq('endpoint', endpoint);
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported, user]);

  return { supported, permission, subscribed, loading, enable, disable };
}
