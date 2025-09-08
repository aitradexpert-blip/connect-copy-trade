import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { user } = useAuth();
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-2">View your account information</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Basic user information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={(user?.user_metadata?.display_name as string) || ''} readOnly />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
