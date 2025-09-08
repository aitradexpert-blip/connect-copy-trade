import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your application preferences</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Update basic app settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" placeholder="e.g. UTC, GMT+1" />
            </div>
            <Button disabled variant="secondary">Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
