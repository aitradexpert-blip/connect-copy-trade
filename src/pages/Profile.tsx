import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Calendar, Shield, CheckCircle, XCircle, Settings, TrendingUp, FileText, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  display_name: string;
  subscription_status: string;
  subscription_plan: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    subscription_status: 'active',
    subscription_plan: 'basic'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kycDocuments, setKycDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, subscription_status, subscription_plan')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
      } else {
        // Initialize profile if not exists
        setProfile({
          display_name: user.user_metadata?.display_name || '',
          subscription_status: 'active',
          subscription_plan: 'basic'
        });
      }

      // Load KYC documents
      const { data: kycData, error: kycError } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false });

      if (!kycError) {
        setKycDocuments(kycData || []);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleKycUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileName = `${user.id}/${documentType}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('kyc-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-docs')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: user.id,
          document_type: documentType,
          image_url: publicUrl,
          status: 'pending'
        });

      if (dbError) throw dbError;

      toast({
        title: 'Document uploaded',
        description: `${documentType} document uploaded successfully and is pending approval`
      });

      // Reload KYC documents
      const { data: kycData } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false });

      setKycDocuments(kycData || []);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: profile.display_name,
          subscription_status: profile.subscription_status,
          subscription_plan: profile.subscription_plan,
        });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
      });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getAccountTypeDisplay = () => {
    if (profile.subscription_plan === 'enterprise') return 'Enterprise';
    if (profile.subscription_plan === 'professional') return 'Professional';
    return 'Basic';
  };

  const isEmailVerified = user?.email_confirmed_at !== null;
  const isPhoneVerified = user?.phone_confirmed_at !== null;
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-2">Manage your account information and preferences</p>
        </div>

        {/* Personal Information */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-gradient-primary text-white text-lg">
                  {(profile.display_name || user?.email || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{profile.display_name || 'Unknown User'}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <Badge variant="outline">{getAccountTypeDisplay()} Member</Badge>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={profile.display_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input value={user?.email || ''} disabled />
              </div>
            </div>

            <div className="flex justify-end">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Account Information
            </CardTitle>
            <CardDescription>Account status and verification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Type</span>
                  <Badge className="bg-gradient-primary text-white">
                    {getAccountTypeDisplay()}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Member Since</span>
                  <span className="text-sm text-muted-foreground">{memberSince}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Status</span>
                  <Badge className="bg-profit text-white">Active</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Verified</span>
                  <div className="flex items-center gap-1">
                    {isEmailVerified ? (
                      <CheckCircle className="w-4 h-4 text-profit" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-sm">
                      {isEmailVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Phone Verified</span>
                  <div className="flex items-center gap-1">
                    {isPhoneVerified ? (
                      <CheckCircle className="w-4 h-4 text-profit" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-sm">
                      {isPhoneVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Preferences */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Trading Preferences
            </CardTitle>
            <CardDescription>Your trading style and risk preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Level</span>
                  <Badge variant="outline">Moderate</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trading Style</span>
                  <span className="text-sm text-muted-foreground">Copy Trading</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Preferred Currency</span>
                  <span className="text-sm text-muted-foreground">USD</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auto Trading</span>
                  <Badge className="bg-profit text-white">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Signal Notifications</span>
                  <Badge className="bg-profit text-white">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Daily Risk</span>
                  <span className="text-sm text-muted-foreground">5%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Account security and authentication settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Last updated 30 days ago</p>
                </div>
                <Button variant="outline" size="sm">Change Password</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm">Setup 2FA</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Manage your login sessions</p>
                </div>
                <Button variant="outline" size="sm">View Sessions</Button>
              </div>
              </div>
            </CardContent>
          </Card>

          {/* KYC Documents Section for South African Users */}
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                KYC Documents (South Africa)
              </CardTitle>
              <CardDescription>
                Upload your identification documents for verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID Document Upload */}
              <div className="space-y-2">
                <Label>South African ID Document</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleKycUpload(e, 'ID_DOCUMENT')}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload ID
                  </Button>
                </div>
              </div>

              {/* Proof of Address Upload */}
              <div className="space-y-2">
                <Label>Proof of Address</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleKycUpload(e, 'PROOF_OF_ADDRESS')}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Proof
                  </Button>
                </div>
              </div>

              {/* Bank Statement Upload */}
              <div className="space-y-2">
                <Label>Bank Statement (Last 3 months)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleKycUpload(e, 'BANK_STATEMENT')}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Statement
                  </Button>
                </div>
              </div>

              {/* Uploaded Documents Status */}
              {kycDocuments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Uploaded Documents</h4>
                  {kycDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{doc.document_type.replace('_', ' ')}</span>
                        <p className="text-sm text-muted-foreground">
                          Uploaded: {new Date(doc.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={doc.status === 'approved' ? 'default' : doc.status === 'pending' ? 'secondary' : 'destructive'}>
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
}
