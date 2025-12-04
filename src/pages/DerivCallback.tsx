import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseDerivRedirectTokens, isVirtualAccount, getAccountTypeLabel, DerivAccount } from "@/services/derivAuth";
import { authorizeDerivAccount } from "@/services/derivBroker";
import { Loader2, Check, AlertCircle, Wallet } from "lucide-react";

export default function DerivCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    console.log("[DerivCallback] Location search:", location.search);
    
    // Parse tokens from URL
    const parsed = parseDerivRedirectTokens(location.search);
    console.log("[DerivCallback] Parsed accounts:", parsed);
    
    if (parsed.length === 0) {
      setError("No accounts found in redirect. Please try connecting again.");
      return;
    }
    
    setAccounts(parsed);
    
    // Auto-select if only one account
    if (parsed.length === 1) {
      setSelectedAccount(parsed[0]);
    }
    
    // Fetch details for each account
    parsed.forEach(async (acc) => {
      try {
        console.log(`[DerivCallback] Authorizing account ${acc.account}...`);
        const authResponse = await authorizeDerivAccount(acc.token);
        console.log(`[DerivCallback] Auth response for ${acc.account}:`, authResponse);
        setAccountDetails(prev => ({
          ...prev,
          [acc.account]: authResponse.authorize
        }));
      } catch (err) {
        console.error(`[DerivCallback] Failed to get details for ${acc.account}:`, err);
      }
    });
  }, [location.search]);

  const handleConnectAccount = async () => {
    if (!selectedAccount) {
      toast({ title: "Please select an account", variant: "destructive" });
      return;
    }
    
    if (!user) {
      toast({ title: "Please log in first", variant: "destructive" });
      navigate('/auth');
      return;
    }
    
    setIsConnecting(true);
    console.log("[DerivCallback] Connecting account:", selectedAccount);
    
    try {
      // Authorize to get full account info
      const authResponse = await authorizeDerivAccount(selectedAccount.token);
      const authData = authResponse.authorize;
      console.log("[DerivCallback] Full auth data:", authData);
      
      // Prepare insert data
      const insertData = {
        user_id: user.id,
        provider: 'deriv',
        provider_account_id: selectedAccount.account,
        name: `Deriv ${getAccountTypeLabel(selectedAccount.account)} (${selectedAccount.account})`,
        login: selectedAccount.account,
        server: 'Deriv',
        platform: 'deriv',
        deriv_token: selectedAccount.token,
        deriv_currency: selectedAccount.currency || authData.currency,
        is_virtual: isVirtualAccount(selectedAccount.account),
        balance: authData.balance || 0,
        equity: authData.balance || 0,
        connection_status: 'connected',
      };
      
      console.log("[DerivCallback] Inserting into trading_accounts:", insertData);
      
      // Insert into trading_accounts with Deriv provider
      const { data: insertedData, error: insertError } = await supabase
        .from("trading_accounts")
        .insert(insertData)
        .select();

      if (insertError) {
        console.error("[DerivCallback] Insert error details:", {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        
        // Check for specific RLS error
        if (insertError.code === '42501') {
          throw new Error("Permission denied. Please ensure you are logged in and try again.");
        }
        throw insertError;
      }
      
      console.log("[DerivCallback] Insert successful:", insertedData);

      toast({
        title: "Deriv account connected!",
        description: `${selectedAccount.account} has been added to your trading accounts.`,
      });

      navigate('/accounts');
    } catch (err: any) {
      console.error('[DerivCallback] Failed to connect Deriv account:', err);
      toast({
        title: "Failed to connect account",
        description: err.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Connection Error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/accounts')} className="w-full">
              Back to Accounts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Connect Deriv Account
          </CardTitle>
          <CardDescription>
            Select the Deriv account you want to connect to HuMi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const details = accountDetails[acc.account];
                  const isSelected = selectedAccount?.account === acc.account;
                  
                  return (
                    <button
                      key={acc.account}
                      onClick={() => setSelectedAccount(acc)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isVirtualAccount(acc.account) ? 'bg-yellow-500/10' : 'bg-green-500/10'
                          }`}>
                            <Wallet className={`w-5 h-5 ${
                              isVirtualAccount(acc.account) ? 'text-yellow-500' : 'text-green-500'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {acc.account}
                              <Badge variant={isVirtualAccount(acc.account) ? "secondary" : "default"}>
                                {getAccountTypeLabel(acc.account)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {details ? (
                                <span className="font-medium">
                                  {details.balance?.toFixed(2)} {details.currency}
                                </span>
                              ) : (
                                <span>Loading...</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/accounts')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConnectAccount}
                  disabled={!selectedAccount || isConnecting}
                  className="flex-1"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Account'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}