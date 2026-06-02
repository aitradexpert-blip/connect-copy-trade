import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { authorizeDerivAccount, getDerivCashierInfo } from "@/services/derivBroker";
import { useToast } from "@/hooks/use-toast";

interface DerivCashierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'deposit' | 'withdraw';
  account: {
    id: string;
    name: string;
    deriv_token: string | null;
    deriv_currency: string | null;
  };
  onComplete?: () => void;
}

export function DerivCashierModal({ open, onOpenChange, type, account, onComplete }: DerivCashierModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cashierUrl, setCashierUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && account.deriv_token) {
      fetchCashierInfo();
    } else {
      setCashierUrl(null);
      setError(null);
    }
  }, [open, account.deriv_token, type]);

  const fetchCashierInfo = async () => {
    if (!account.deriv_token) {
      setError("No Deriv token available for this account");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First authorize
      await authorizeDerivAccount(account.deriv_token);
      
      // Then get cashier info
      const cashierResponse = await getDerivCashierInfo(type);
      
      // The response may contain a URL or cashier information
      if (cashierResponse.cashier) {
        setCashierUrl(cashierResponse.cashier);
      } else if (cashierResponse.error) {
        throw new Error(cashierResponse.error.message);
      } else {
        // For some account types, direct cashier might not be available
        // Redirect to Deriv's cashier page
        const baseUrl = 'https://app.deriv.com/cashier';
        setCashierUrl(`${baseUrl}/${type}`);
      }
    } catch (err: any) {
      console.error('Cashier error:', err);
      setError(err.message || 'Failed to load cashier information');
      
      // Fallback to Deriv's web cashier
      const baseUrl = 'https://app.deriv.com/cashier';
      setCashierUrl(`${baseUrl}/${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCashier = () => {
    if (cashierUrl) {
      window.open(cashierUrl, '_blank');
      toast({
        title: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} page opened`,
        description: "Complete the transaction in the new tab, then return here.",
      });
      onOpenChange(false);
      onComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === 'deposit' ? 'Deposit to' : 'Withdraw from'} Deriv
          </DialogTitle>
          <DialogDescription>
            {account.name} ({account.deriv_currency || 'USD'})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading cashier...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-8 h-8 text-yellow-500 mb-4" />
              <p className="text-muted-foreground text-center mb-4">{error}</p>
              {cashierUrl && (
                <Button onClick={handleOpenCashier} className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Deriv Cashier
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You will be redirected to Deriv's secure {type} page to complete your transaction.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Important:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Complete the transaction on Deriv's website</li>
                  <li>Return here after the transaction is complete</li>
                  <li>Refresh your account to see updated balance</li>
                </ul>
              </div>

              <Button onClick={handleOpenCashier} className="w-full flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                {type === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}