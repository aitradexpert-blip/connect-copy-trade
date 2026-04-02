import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Trash2, CheckCircle, Crown, Search, UserPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";

interface User {
  id: string;
  email: string;
  created_at: string;
  display_name?: string;
  subscription?: {
    plan_name: string;
    status: string;
    expires_at: string | null;
  };
  trading_accounts?: {
    id: string;
    name: string;
    connection_status: string;
    metaapi_account_id?: string | null;
    provider?: string;
  }[];
}

export function UserManagementTab() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const { plans: dbPlans } = useSubscriptionPlans();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const SUBSCRIPTION_PLANS = useMemo(() => {
    const freePlan = { value: 'free', label: 'Free', price: 'R0/mo' };
    if (dbPlans.length === 0) {
      return [
        freePlan,
        { value: 'basic', label: 'Basic', price: 'R178.20/mo' },
        { value: 'professional', label: 'Professional', price: 'R538.20/mo' },
        { value: 'enterprise', label: 'Enterprise', price: 'R719.82/mo' },
      ];
    }
    return [
      freePlan,
      ...dbPlans.map(plan => ({
        value: plan.name.toLowerCase(),
        label: plan.name.charAt(0).toUpperCase() + plan.name.slice(1),
        price: `R${plan.price_zar.toFixed(2)}/mo`,
      })),
    ];
  }, [dbPlans]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Fetch emails from admin edge function
      let emailMap: Record<string, string> = {};
      try {
        const { data: authData, error: authError } = await supabase.functions.invoke('admin-list-users');
        if (!authError && authData?.users) {
          for (const u of authData.users) {
            emailMap[u.id] = u.email;
          }
        }
      } catch (e) {
        console.warn('Could not fetch auth users, falling back to display_name:', e);
      }

      // Get all profiles (admin RLS policy now allows this)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, created_at');

      if (profilesError) throw profilesError;

      const usersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('plan_name, status, expires_at')
            .eq('user_id', profile.user_id)
            .single();

          const { data: accounts } = await supabase
            .from('trading_accounts')
            .select('id, name, connection_status, metaapi_account_id, provider')
            .eq('user_id', profile.user_id);

          return {
            id: profile.user_id,
            email: emailMap[profile.user_id] || profile.display_name || 'N/A',
            display_name: profile.display_name,
            created_at: profile.created_at,
            subscription: subscription || undefined,
            trading_accounts: accounts || [],
          };
        })
      );

      setUsers(usersWithData);
    } catch (error: any) {
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.subscription?.plan_name?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const openApprovalModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlan(user.subscription?.plan_name || "free");
    setShowApprovalModal(true);
  };

  const openSubscriptionModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlan(user.subscription?.plan_name || "free");
    setShowSubscriptionModal(true);
  };

  const approveUser = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      if (selectedPlan === 'free') {
        // For free plan, delete any existing subscription
        await supabase.from('user_subscriptions').delete().eq('user_id', selectedUser.id);
      } else {
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: selectedUser.id,
            plan_name: selectedPlan,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
          }, { onConflict: 'user_id' });

        if (subError) throw subError;
      }

      toast({
        title: 'User updated!',
        description: `${selectedUser.email} set to ${selectedPlan} plan`
      });

      setShowApprovalModal(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const updateSubscription = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      if (selectedPlan === 'free') {
        await supabase.from('user_subscriptions').delete().eq('user_id', selectedUser.id);
      } else {
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: selectedUser.id,
            plan_name: selectedPlan,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
          }, { onConflict: 'user_id' });

        if (subError) throw subError;
      }

      toast({
        title: 'Subscription Updated',
        description: `${selectedUser.email} is now on the ${selectedPlan} plan`
      });

      setShowSubscriptionModal(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) return;

    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('user_subscriptions').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);

      toast({ title: 'User deleted', description: `User ${email} has been removed` });
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management ({users.length} users)
          </h2>
          <p className="text-muted-foreground mt-1">
            View all users, manage subscriptions and accounts
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button onClick={loadUsers} variant="outline">Refresh</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Accounts</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.subscription ? 'default' : 'secondary'}>
                  {user.subscription?.plan_name || 'Free'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.subscription?.status === 'active' ? 'default' : 'secondary'}
                >
                  {user.subscription?.status || (user.subscription ? 'Inactive' : 'Free')}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {user.subscription?.expires_at 
                  ? new Date(user.subscription.expires_at).toLocaleDateString() 
                  : '-'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {user.trading_accounts?.map((acc) => (
                    <Badge
                      key={acc.id}
                      variant={acc.connection_status === 'connected' ? 'default' : 'outline'}
                      className={`text-xs ${acc.connection_status === 'connected' ? 'bg-green-600' : ''}`}
                    >
                      {acc.name}: {acc.connection_status}
                    </Badge>
                  ))}
                  {(!user.trading_accounts || user.trading_accounts.length === 0) && (
                    <span className="text-xs text-muted-foreground">No accounts</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => openApprovalModal(user)}
                    className="bg-profit text-white hover:bg-profit/80"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {user.subscription?.status === 'active' ? 'Modify' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSubscriptionModal(user)}
                    title="Change subscription tier"
                  >
                    <Crown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteUser(user.id, user.email)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="bg-gradient-card border-border">
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>
              Configure subscription for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedUser?.trading_accounts && selectedUser.trading_accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Trading Accounts</Label>
                <div className="space-y-2">
                  {selectedUser.trading_accounts.map((acc) => (
                    <div 
                      key={acc.id} 
                      className={`p-3 rounded-lg border ${
                        acc.connection_status === 'connected' 
                          ? 'bg-green-900/20 border-green-700' 
                          : 'bg-muted border-border'
                      }`}
                    >
                      <p className="text-sm font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: <span className={acc.connection_status === 'connected' ? 'text-green-400' : 'text-muted-foreground'}>{acc.connection_status}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label} ({plan.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowApprovalModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={approveUser} className="flex-1 bg-gradient-primary" disabled={processing}>
                {processing ? 'Processing...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Update Modal */}
      <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
        <DialogContent className="bg-gradient-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Update Subscription Tier
            </DialogTitle>
            <DialogDescription>
              Change the subscription plan for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Current Plan:</strong>{' '}
                <Badge variant="outline">
                  {selectedUser?.subscription?.plan_name || 'Free'}
                </Badge>
              </p>
              <p className="text-sm mt-1">
                <strong>Status:</strong>{' '}
                <Badge variant={selectedUser?.subscription?.status === 'active' ? 'default' : 'secondary'}>
                  {selectedUser?.subscription?.status || 'Free'}
                </Badge>
              </p>
            </div>

            <div className="space-y-2">
              <Label>New Subscription Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      <div className="flex items-center gap-2">
                        {plan.label}
                        <span className="text-muted-foreground">({plan.price})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSubscriptionModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={updateSubscription} className="flex-1 bg-gradient-primary" disabled={processing}>
                {processing ? 'Processing...' : 'Update Subscription'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
