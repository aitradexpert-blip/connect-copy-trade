import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Trash2, CheckCircle, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  created_at: string;
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

const SUBSCRIPTION_PLANS = [
  { value: 'basic', label: 'Basic', price: 'R99/mo' },
  { value: 'professional', label: 'Professional', price: 'R299/mo' },
  { value: 'enterprise', label: 'Enterprise', price: 'R399/mo' },
];

export function UserManagementTab() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [metaapiId, setMetaapiId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [processing, setProcessing] = useState(false);
  const [modalTab, setModalTab] = useState<'account' | 'subscription'>('account');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get all users from auth.users via profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          display_name,
          created_at
        `);

      if (profilesError) throw profilesError;

      // Get user emails from auth metadata
      const usersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get subscription
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('plan_name, status, expires_at')
            .eq('user_id', profile.user_id)
            .single();

          // Get trading accounts with more details
          const { data: accounts } = await supabase
            .from('trading_accounts')
            .select('id, name, connection_status, metaapi_account_id, provider')
            .eq('user_id', profile.user_id);

          // Get user email from user_roles table
          const { data: role } = await supabase
            .from('user_roles')
            .select('email')
            .eq('user_id', profile.user_id)
            .single();

          return {
            id: profile.user_id,
            email: role?.email || 'N/A',
            created_at: profile.created_at,
            subscription,
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

  const openApprovalModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlan(user.subscription?.plan_name || "basic");
    setMetaapiId("");
    setModalTab('account');
    setShowApprovalModal(true);
  };

  const openSubscriptionModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlan(user.subscription?.plan_name || "basic");
    setShowSubscriptionModal(true);
  };

  const approveUser = async () => {
    if (!selectedUser) {
      toast({
        title: 'Missing information',
        description: 'No user selected',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);

    try {
      // Create/activate subscription (accounts are auto-provisioned now)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: selectedUser.id,
          plan_name: selectedPlan,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (subError) throw subError;

      // 3. Ensure user role exists
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: selectedUser.id,
          email: selectedUser.email,
          role: 'user'
        });

      if (roleError) throw roleError;

      toast({
        title: 'User approved!',
        description: `${selectedUser.email} has been activated with ${selectedPlan} plan`
      });

      setShowApprovalModal(false);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Error approving user',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const updateSubscription = async () => {
    if (!selectedUser) {
      toast({
        title: 'Missing information',
        description: 'No user selected',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);

    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: selectedUser.id,
          plan_name: selectedPlan,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (subError) throw subError;

      toast({
        title: 'Subscription Updated',
        description: `${selectedUser.email} is now on the ${selectedPlan} plan`
      });

      setShowSubscriptionModal(false);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Error updating subscription',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete from user_roles
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete from user_subscriptions
      await supabase.from('user_subscriptions').delete().eq('user_id', userId);
      
      // Delete from profiles
      await supabase.from('profiles').delete().eq('user_id', userId);

      toast({
        title: 'User deleted',
        description: `User ${email} has been removed from the system`
      });

      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Error deleting user',
        description: error.message,
        variant: 'destructive'
      });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Approve users and manage subscriptions
          </p>
        </div>
        <Button onClick={loadUsers} variant="outline">
          Refresh
        </Button>
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
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.subscription ? 'default' : 'secondary'}>
                  {user.subscription?.plan_name || 'None'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    user.subscription?.status === 'active'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {user.subscription?.status || 'Inactive'}
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
                      variant={
                        acc.connection_status === 'connected'
                          ? 'default'
                          : acc.connection_status === 'provisioning'
                          ? 'secondary'
                          : 'outline'
                      }
                      className={`text-xs ${
                        acc.connection_status === 'connected' ? 'bg-green-600' : 
                        acc.connection_status === 'provisioning' ? 'bg-amber-600' : ''
                      }`}
                    >
                      {acc.name}: {acc.connection_status}
                      {acc.metaapi_account_id && ' ✓'}
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
            <DialogTitle>Approve User & Configure Account</DialogTitle>
            <DialogDescription>
              Configure MetaAPI integration and subscription plan for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Show account status - accounts are now auto-provisioned */}
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
                          : acc.connection_status === 'provisioning'
                          ? 'bg-amber-900/20 border-amber-700'
                          : 'bg-muted border-border'
                      }`}
                    >
                      <p className="text-sm font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: <span className={
                          acc.connection_status === 'connected' ? 'text-green-400' :
                          acc.connection_status === 'provisioning' ? 'text-amber-400' : 'text-muted-foreground'
                        }>{acc.connection_status}</span>
                        {acc.metaapi_account_id && (
                          <span className="ml-2">• MetaAPI: ✓ Connected</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!selectedUser?.trading_accounts || selectedUser.trading_accounts.length === 0) && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">No trading accounts connected</p>
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
              <p className="text-xs text-muted-foreground">
                Trading accounts are now auto-provisioned via MetaAPI when users connect.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowApprovalModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={approveUser}
                className="flex-1 bg-gradient-primary"
                disabled={processing}
              >
                {processing ? 'Processing...' : (selectedUser?.subscription?.status === 'active' ? 'Update Subscription' : 'Activate Subscription')}
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
                  {selectedUser?.subscription?.plan_name || 'None'}
                </Badge>
              </p>
              <p className="text-sm mt-1">
                <strong>Status:</strong>{' '}
                <Badge variant={selectedUser?.subscription?.status === 'active' ? 'default' : 'secondary'}>
                  {selectedUser?.subscription?.status || 'Inactive'}
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
              <p className="text-xs text-muted-foreground">
                The subscription will be activated immediately and expire in 1 month
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSubscriptionModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={updateSubscription}
                className="flex-1 bg-gradient-primary"
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Update Subscription'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}