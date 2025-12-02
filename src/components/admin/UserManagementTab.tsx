import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Eye, Trash2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  created_at: string;
  subscription?: {
    plan_name: string;
    status: string;
  };
  trading_accounts?: {
    id: string;
    name: string;
    connection_status: string;
  }[];
}

export function UserManagementTab() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [metaapiId, setMetaapiId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [processing, setProcessing] = useState(false);

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
            .select('plan_name, status')
            .eq('user_id', profile.user_id)
            .single();

          // Get trading accounts
          const { data: accounts } = await supabase
            .from('trading_accounts')
            .select('id, name, connection_status')
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
    // Pre-fill existing subscription if modifying
    setSelectedPlan(user.subscription?.plan_name || "basic");
    setMetaapiId("");
    setShowApprovalModal(true);
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
      // 1. Update pending trading account with MetaAPI ID
      const pendingAccount = selectedUser.trading_accounts?.find(
        acc => acc.connection_status === 'pending_approval'
      );

      if (pendingAccount) {
        const { error: accountError } = await supabase
          .from('trading_accounts')
          .update({
            metaapi_account_id: metaapiId,
            connection_status: 'connected'
          })
          .eq('id', pendingAccount.id);

        if (accountError) throw accountError;
      }

      // 2. Create/activate subscription
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
              <TableCell>
                <div className="flex flex-col gap-1">
                  {user.trading_accounts?.map((acc) => (
                    <Badge
                      key={acc.id}
                      variant={
                        acc.connection_status === 'connected'
                          ? 'default'
                          : 'outline'
                      }
                      className="text-xs"
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
            <DialogTitle>Approve User & Activate Subscription</DialogTitle>
            <DialogDescription>
              Configure MetaAPI integration and subscription plan for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedUser?.trading_accounts?.find(
              acc => acc.connection_status === 'pending_approval'
            ) && (
              <div className="p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
                <p className="text-sm text-amber-200">
                  Pending Account: {selectedUser.trading_accounts.find(
                    acc => acc.connection_status === 'pending_approval'
                  )?.name}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>MetaAPI Account ID</Label>
              <Input
                placeholder="Enter MetaAPI Account ID"
                value={metaapiId}
                onChange={(e) => setMetaapiId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This will link the user's trading account to MetaAPI
              </p>
            </div>

            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic ($9.90/mo)</SelectItem>
                  <SelectItem value="professional">Professional ($29.90/mo)</SelectItem>
                  <SelectItem value="enterprise">Enterprise ($39.99/mo)</SelectItem>
                </SelectContent>
              </Select>
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
                {processing ? 'Processing...' : (selectedUser?.subscription?.status === 'active' ? 'Update Subscription' : 'Approve & Activate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
