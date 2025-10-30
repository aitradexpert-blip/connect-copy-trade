import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";

interface KYCData {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  physical_address: string;
  city: string;
  province: string;
  postal_code: string;
  document_type: string;
  image_url: string;
  proof_of_residence_url: string;
  bank_statement_url: string;
}

export default function KYCWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<KYCData>({
    full_name: '',
    id_number: '',
    date_of_birth: '',
    physical_address: '',
    city: '',
    province: '',
    postal_code: '',
    document_type: 'id_document',
    image_url: '',
    proof_of_residence_url: '',
    bank_statement_url: ''
  });

  const handleFileUpload = async (file: File, fieldName: string) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${fieldName}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-docs')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, [fieldName]: publicUrl }));
      
      toast({
        title: "File Uploaded",
        description: "Document uploaded successfully",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: user.id,
          ...formData,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "KYC Submitted",
        description: "Your KYC documents have been submitted for review",
      });

      // Reset form
      setStep(1);
      setFormData({
        full_name: '',
        id_number: '',
        date_of_birth: '',
        physical_address: '',
        city: '',
        province: '',
        postal_code: '',
        document_type: 'id_document',
        image_url: '',
        proof_of_residence_url: '',
        bank_statement_url: ''
      });
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>FICA-Compliant KYC Verification</CardTitle>
        <CardDescription>
          Step {step} of 4 - Complete all steps to verify your identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <>
            <h3 className="font-semibold text-lg mb-4">Personal Details</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="As per ID document"
                />
              </div>
              <div>
                <Label htmlFor="id_number">South African ID Number</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="13 digits"
                  maxLength={13}
                />
              </div>
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={() => setStep(2)} className="w-full">
              Next: Address Information
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-semibold text-lg mb-4">Address Information</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="physical_address">Physical Address</Label>
                <Input
                  id="physical_address"
                  value={formData.physical_address}
                  onChange={(e) => setFormData({ ...formData, physical_address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="province">Province</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next: Document Upload
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-semibold text-lg mb-4">Document Upload</h3>
            <div className="space-y-4">
              <div>
                <Label>ID Document Copy</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image_url')}
                    disabled={uploading}
                  />
                  {formData.image_url && <span className="text-sm text-green-600">✓ Uploaded</span>}
                </div>
              </div>
              <div>
                <Label>Proof of Residence (Utility bill, bank statement)</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'proof_of_residence_url')}
                    disabled={uploading}
                  />
                  {formData.proof_of_residence_url && <span className="text-sm text-green-600">✓ Uploaded</span>}
                </div>
              </div>
              <div>
                <Label>Bank Statement (Optional)</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'bank_statement_url')}
                    disabled={uploading}
                  />
                  {formData.bank_statement_url && <span className="text-sm text-green-600">✓ Uploaded</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1" disabled={!formData.image_url || !formData.proof_of_residence_url}>
                Review & Submit
              </Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="font-semibold text-lg mb-4">Review Your Information</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {formData.full_name}</p>
              <p><strong>ID Number:</strong> {formData.id_number}</p>
              <p><strong>Date of Birth:</strong> {formData.date_of_birth}</p>
              <p><strong>Address:</strong> {formData.physical_address}, {formData.city}, {formData.province}, {formData.postal_code}</p>
              <p><strong>Documents:</strong> {formData.image_url ? '✓' : '✗'} ID, {formData.proof_of_residence_url ? '✓' : '✗'} Proof of Residence</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit KYC'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
