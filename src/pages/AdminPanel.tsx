import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Eye, FileText, CreditCard } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";

export default function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const [paymentProofs, setPaymentProofs] = useState<any[]>([]);
  const [kycDocuments, setKycDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || adminLoading) return;
    loadData();
  }, [isAdmin, adminLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load payment proofs
      const { data: proofs, error: proofsError } = await supabase
        .from('payment_proofs')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (proofsError) throw proofsError;
      setPaymentProofs(proofs || []);

      // Load KYC documents
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">
            Manage payment approvals and KYC document reviews
          </p>
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Proofs
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              KYC Documents
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>
    </AppLayout>
  );
}