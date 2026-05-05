import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Eye, FileText, CreditCard, Users, ArrowLeftRight, TrendingUp, Crown, Activity } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { UserManagementTab } from "@/components/admin/UserManagementTab";
import { TransferMonitoringTab } from "@/components/admin/TransferMonitoringTab";
import { MentorManagementTab } from "@/components/admin/MentorManagementTab";
import { MetaApiHealthTab } from "@/components/admin/MetaApiHealthTab";

export default function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const [paymentProofs, setPaymentProofs] = useState<any[]>([]);
  const [kycDocuments, setKycDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    pendingUsers: 0,
    pendingPayments: 0,
    pendingTransfers: 0,
    activeTrades: 0
  });

  useEffect(() => {
    if (!isAdmin || adminLoading) return;
    loadData();
    loadCounts();
  }, [isAdmin, adminLoading]);

  const loadCounts = async () => {
    try {
      // Count pending payment proofs
      const { count: paymentCount } = await supabase
        .from('payment_proofs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Count pending transfers
      const { count: transferCount } = await supabase
        .from('fund_transfers')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'processing']);

      // Count pending KYC (approximate pending users)
      const { count: kycCount } = await supabase
        .from('kyc_documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Count active trading ideas
      const { count: tradesCount } = await supabase
        .from('trading_signals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      setCounts({
        pendingUsers: kycCount || 0,
        pendingPayments: paymentCount || 0,
        pendingTransfers: transferCount || 0,
        activeTrades: tradesCount || 0
      });
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: proofs, error: proofsError } = await supabase
        .from('payment_proofs')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (proofsError) throw proofsError;
      setPaymentProofs(proofs || []);

      const { data: kyc, error: kycError } = await supabase
        .from('kyc_documents')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (kycError) throw kycError;
      setKycDocuments(kyc || []);
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const approvePayment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_proofs')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Payment approved',
        description: 'Payment proof has been approved successfully'
      });

      loadData();
      loadCounts();
    } catch (error: any) {
      toast({
        title: 'Error approving payment',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const approveKyc = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'KYC document approved',
        description: 'KYC document has been approved successfully'
      });

      loadData();
      loadCounts();
    } catch (error: any) {
      toast({
        title: 'Error approving KYC',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const rejectDocument = async (id: string, type: 'payment' | 'kyc') => {
    try {
      const table = type === 'payment' ? 'payment_proofs' : 'kyc_documents';
      const { error } = await supabase
        .from(table)
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: `${type === 'payment' ? 'Payment' : 'KYC'} rejected`,
        description: `${type === 'payment' ? 'Payment proof' : 'KYC document'} has been rejected`
      });

      loadData();
      loadCounts();
    } catch (error: any) {
      toast({
        title: 'Error rejecting document',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (adminLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Checking admin access...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">
            Manage users, payments, and transfers
          </p>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border shadow-card cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{counts.pendingUsers}</div>
              <div className="text-sm text-muted-foreground">Pending KYC</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 text-center">
              <CreditCard className="w-8 h-8 mx-auto text-profit mb-2" />
              <div className="text-2xl font-bold">{counts.pendingPayments}</div>
              <div className="text-sm text-muted-foreground">Payment Proofs</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 text-center">
              <ArrowLeftRight className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{counts.pendingTransfers}</div>
              <div className="text-sm text-muted-foreground">Pending Transfers</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold">{counts.activeTrades}</div>
              <div className="text-sm text-muted-foreground">Active Ideas</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="users" className="flex items-center gap-2 whitespace-nowrap">
                <Users className="w-4 h-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2 whitespace-nowrap">
                <CreditCard className="w-4 h-4" />
                Payments
                {counts.pendingPayments > 0 && (
                  <Badge variant="secondary" className="ml-1">{counts.pendingPayments}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="kyc" className="flex items-center gap-2 whitespace-nowrap">
                <FileText className="w-4 h-4" />
                KYC
                {counts.pendingUsers > 0 && (
                  <Badge variant="secondary" className="ml-1">{counts.pendingUsers}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="transfers" className="flex items-center gap-2 whitespace-nowrap">
                <ArrowLeftRight className="w-4 h-4" />
                Transfers
                {counts.pendingTransfers > 0 && (
                  <Badge variant="secondary" className="ml-1">{counts.pendingTransfers}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mentors" className="flex items-center gap-2 whitespace-nowrap">
                <Crown className="w-4 h-4" />
                Mentors
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2 whitespace-nowrap">
                <Activity className="w-4 h-4" />
                MetaAPI Health
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>

          <TabsContent value="payments">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Payment Proof Approvals</CardTitle>
                <CardDescription>
                  Review and approve payment proofs submitted by users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentProofs.map((proof) => (
                      <TableRow key={proof.id}>
                        <TableCell>{proof.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{proof.plan}</Badge>
                        </TableCell>
                        <TableCell>R{proof.amount}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={proof.status === 'approved' ? 'default' : proof.status === 'pending' ? 'secondary' : 'destructive'}
                          >
                            {proof.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(proof.submitted_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(proof.image_url, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {proof.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => approvePayment(proof.id)}
                                  className="bg-profit text-white"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectDocument(proof.id, 'payment')}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyc">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>KYC Document Reviews</CardTitle>
                <CardDescription>
                  Review and approve KYC documents submitted by users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kycDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>{doc.user_id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.document_type.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={doc.status === 'approved' ? 'default' : doc.status === 'pending' ? 'secondary' : 'destructive'}
                          >
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(doc.submitted_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.image_url, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {doc.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => approveKyc(doc.id)}
                                  className="bg-profit text-white"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectDocument(doc.id, 'kyc')}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers">
            <TransferMonitoringTab />
          </TabsContent>

          <TabsContent value="mentors">
            <MentorManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
