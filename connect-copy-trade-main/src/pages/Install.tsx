import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Download, Apple, Bell, Shield, MessageCircle, Wifi } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const APK_URL = "/HuMi_Mobile.apk";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VaY0Klp9Gv7VhypIt61A";
const WHATSAPP_BUSINESS = "https://wa.me/message/WOH4AWGKQWSWL1";

export default function Install() {
  const { canInstall, install } = usePWAInstall();

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification("HuMi notifications enabled", {
          body: "You'll get trade ideas, executions, and account alerts here.",
          icon: "/icons/icon-192x192.png",
        });
      }
    } catch (e) { console.warn(e); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <Smartphone className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-3xl font-bold">Install HuMi on your phone</h1>
          <p className="text-muted-foreground">Native experience, push notifications, fast access.</p>
        </header>

        {/* Android APK */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" /> Android
              <Badge className="ml-2">Recommended</Badge>
            </CardTitle>
            <CardDescription>Direct APK install. Push notifications + full screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild size="lg" className="w-full">
              <a href={APK_URL} download="HuMi.apk">
                <Download className="w-5 h-5 mr-2" /> Download HuMi.apk
              </a>
            </Button>
            <ol className="text-sm space-y-1.5 list-decimal list-inside text-muted-foreground">
              <li>Tap the file in your downloads.</li>
              <li>Allow "Install unknown apps" for Chrome/Files when prompted (Settings → Apps → Special access).</li>
              <li>Open HuMi, sign in, and allow notifications when asked.</li>
            </ol>
          </CardContent>
        </Card>

        {/* iOS PWA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="w-5 h-5" /> iPhone / iPad
            </CardTitle>
            <CardDescription>Add to Home Screen — works like a native app.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="text-sm space-y-1.5 list-decimal list-inside">
              <li>Open this page in <strong>Safari</strong>.</li>
              <li>Tap the Share icon (square with arrow).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>. HuMi appears on your home screen.</li>
            </ol>
          </CardContent>
        </Card>

        {/* PWA install for desktop / supported browsers */}
        {canInstall && (
          <Card>
            <CardHeader>
              <CardTitle>Install as Web App</CardTitle>
              <CardDescription>Quick install via your browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={install} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Install HuMi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Enable notifications</CardTitle>
            <CardDescription>Get trade idea alerts, executions, and account updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={requestNotifications} variant="outline">
              <Bell className="w-4 h-4 mr-2" /> Allow notifications
            </Button>
          </CardContent>
        </Card>

        {/* GPS / location fix tip */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wifi className="w-5 h-5" /> Broker registration tip</CardTitle>
            <CardDescription>Some brokers require unblocked location on first signup.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>If a broker page says "country not supported" or "GPS error":</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Chrome → Settings → Site Settings → Location → Allow.</li>
              <li>Safari → Settings → Privacy → Location Services → Safari → Allow.</li>
              <li>Reload the broker page and try again.</li>
            </ol>
          </CardContent>
        </Card>

        {/* WhatsApp links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-500" /> Stay connected</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <a href={WHATSAPP_CHANNEL} target="_blank" rel="noopener">Join WhatsApp Channel</a>
            </Button>
            <Button asChild variant="outline">
              <a href={WHATSAPP_BUSINESS} target="_blank" rel="noopener">Chat on WhatsApp</a>
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> APK is signed and built specifically for HuMi via Median.co.
        </p>
      </div>
    </AppLayout>
  );
}
