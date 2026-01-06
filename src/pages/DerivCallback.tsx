import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseDerivRedirectTokens, isVirtualAccount, getAccountTypeLabel, DerivAccount } from "@/services/derivAuth";
import { authorizeDerivAccount, getMT5AccountList, MT5Account } from "@/services/derivBroker";
import { Loader2, Check, AlertCircle, Wallet, RefreshCw, BarChart3 } from "lucide-react";

// Retry helper with exponential backoff + jitter
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function jitter(ms: number) { return ms + Math.floor(Math.random() * 100); }

async function retryAsync<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try { 
      return await fn(); 
    } catch (err) {
      lastError = err;
      await sleep(jitter(400 * Math.pow(2, i))); // 400ms, 800ms, 1600ms + jitter
    }
  }
  throw lastError;
}

export default function DerivCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const mountedRef = useRef(true);
  
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState<Record<string, any>>({});
  const [mt5Accounts, setMT5Accounts] = useState<MT5Account[]>([]);
  const [selectedMT5, setSelectedMT5] = useState<MT5Account | null>(null);
  const [correlationId] = useState(() => `cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

  useEffect(() => {
    mountedRef.current = true;
    
    // ========== STEP 1: Log the full redirect URL ==========
    console.log("=".repeat(60));
    console.log("[Deriv OAuth] STEP 1: Processing OAuth Redirect");
    console.log("[Deriv OAuth] Full Returned URL:", window.location.href);
    console.log("[Deriv OAuth] Query String:", location.search);
    console.log("[Deriv OAuth] Hash Fragment:", location.hash);
    console.log("[Deriv OAuth] Correlation ID:", correlationId);
    console.log("=".repeat(60));
    
    // Store debug info in localStorage (no sensitive data)
    const debugInfo = {
      timestamp: new Date().toISOString(),
      step: 'redirect_received',
      search: location.search ? '[present]' : '[empty]',
      hash: location.hash ? '[present]' : '[empty]',
      searchLength: location.search?.length || 0,
      hashLength: location.hash?.length || 0,
      cid: correlationId,
      userId: user?.id || 'not_logged_in',
      origin: window.location.origin,
    };
    localStorage.setItem('deriv_debug', JSON.stringify(debugInfo));
    
    // Parse tokens from BOTH query params AND hash params
    const parsed = parseDerivRedirectTokens(location.search, location.hash);
    
    console.log("[Deriv OAuth] Parsed Accounts:", parsed.map(a => ({ 
      loginid: a.account, 
      currency: a.currency 
    })));
    console.log("[Deriv OAuth] Total accounts found:", parsed.length);
    
    // Update localStorage with accounts found
    localStorage.setItem('deriv_debug', JSON.stringify({
      ...debugInfo,
      step: 'tokens_parsed',
      accountsFound: parsed.length,
      accountIds: parsed.map(a => a.account),
    }));
    
    if (parsed.length === 0) {
      const errorMsg = "No Deriv accounts found in redirect URL. This may happen if:\n" +
        "• The OAuth redirect URL is not registered in Deriv app settings\n" +
        "• You cancelled the authorization\n" +
        "• The browser blocked the redirect";
      setError(errorMsg);
      return;
    }
    
    if (!mountedRef.current) return;
    setAccounts(parsed);
    
    // Auto-select if only one account
    if (parsed.length === 1) {
      setSelectedAccount(parsed[0]);
    }
    
    // ========== STEP 2: Authorize with WebSocket ==========
    console.log("=".repeat(60));
    console.log("[Deriv OAuth] STEP 2: WebSocket Authorization");
    console.log("=".repeat(60));
    
    // Authorize first account and fetch MT5 accounts
    const authorizeAndFetchMT5 = async () => {
      for (const acc of parsed) {
        try {
          console.log(`[Deriv WS] Connecting and authorizing account ${acc.account}...`);
          const authResponse = await authorizeDerivAccount(acc.token);
          if (!mountedRef.current) return;
          
          console.log("[Deriv WS] Response:", {
            success: !!authResponse.authorize,
            loginid: authResponse.authorize?.loginid,
            balance: authResponse.authorize?.balance,
            currency: authResponse.authorize?.currency,
            account_list: authResponse.authorize?.account_list?.length || 0
          });
          console.log(`✅ Authorized! Account: ${acc.account}, Balance: ${authResponse.authorize?.balance} ${authResponse.authorize?.currency}`);
          
          setAccountDetails(prev => ({
            ...prev,
            [acc.account]: authResponse.authorize
          }));
          
          // Fetch MT5 accounts after first successful authorization
          if (parsed.indexOf(acc) === 0) {
            try {
              console.log("[Deriv WS] Fetching MT5 accounts...");
              const mt5Response = await getMT5AccountList();
              console.log(`✅ Found ${mt5Response.mt5_login_list.length} MT5 accounts`);
              if (mountedRef.current) {
                setMT5Accounts(mt5Response.mt5_login_list);
              }
            } catch (mt5Err: any) {
              console.log("[Deriv WS] No MT5 accounts or error:", mt5Err?.message);
            }
          }
        } catch (err: any) {
          console.error(`❌ Authorization failed for ${acc.account}:`, err?.message);
        }
      }
    };
    
    authorizeAndFetchMT5();
    
    return () => {
      mountedRef.current = false;
    };
  }, [location.search, location.hash, correlationId, user?.id]);

  const handleConnectAccount = async () => {
    if (!selectedAccount) {
      toast({ title: "Please select an account", variant: "destructive" });
      return;
    }
    
    if (!user) {
      toast({ 
        title: "Not logged in", 
        description: "Please log in first to connect your Deriv account.",
        variant: "destructive" 
      });
      navigate('/auth');
      return;
    }
    
    setIsConnecting(true);
    console.log("[DerivCallback] Connecting account:", selectedAccount.account, "CID:", correlationId);
    
    try {
      // Authorize to get full account info
      const authResponse = await authorizeDerivAccount(selectedAccount.token);
      const authData = authResponse.authorize;
      console.log("[DerivCallback] Full auth data received, balance:", authData?.balance, "CID:", correlationId);
      
      // Prepare upsert data
      const upsertData = {
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
      
      console.log("[DerivCallback] Upserting account:", selectedAccount.account, "for user:", user.id, "CID:", correlationId);
      
      // Upsert with retry and exponential backoff
      const upsertFn = async () => {
        const { data: upsertedData, error: upsertError } = await supabase
          .from("trading_accounts")
          .upsert(upsertData, { 
            onConflict: 'user_id,provider,provider_account_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        console.log("[DerivCallback] Upsert result:", { 
          success: !upsertError, 
          dataId: upsertedData?.id,
          errorCode: upsertError?.code,
          cid: correlationId 
        });

        if (upsertError) {
          console.error("[DerivCallback] Upsert error:", {
            code: upsertError.code,
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            cid: correlationId
          });
          
          // Provide specific error messages
          if (upsertError.code === '42501') {
            throw new Error("Permission denied. This usually means Row Level Security blocked the insert. Please ensure you are logged in and try again.");
          }
          if (upsertError.code === '23505') {
            throw new Error("This account is already connected. Refreshing your accounts list...");
          }
          if (upsertError.code === '23503') {
            throw new Error("Database constraint error. Please contact support.");
          }
          throw new Error(upsertError.message || "Failed to save account to database.");
        }
        
        return upsertedData;
      };
      
      const insertedData = await retryAsync(upsertFn, 3);
      
      if (!mountedRef.current) return;
      
      console.log("[DerivCallback] Upsert successful, account ID:", insertedData?.id, "CID:", correlationId);

      toast({
        title: "Deriv account connected!",
        description: `${selectedAccount.account} has been added to your trading accounts.`,
      });

      // Navigate to accounts page
      navigate('/accounts');
    } catch (err: any) {
      console.error('[DerivCallback] Failed to connect Deriv account:', err?.message, "CID:", correlationId);
      
      if (!mountedRef.current) return;
      
      // For duplicate key error, still navigate to accounts
      if (err.message?.includes('already connected')) {
        toast({
          title: "Account already exists",
          description: "This Deriv account is already in your list.",
        });
        navigate('/accounts');
        return;
      }
      
      setError(err.message || "Failed to connect account. Please try again.");
      toast({
        title: "Failed to connect account",
        description: err.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      if (mountedRef.current) setIsConnecting(false);
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
            <CardDescription className="whitespace-pre-line">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Correlation ID: {correlationId}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Authorization
            </Button>
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
              {/* Wallet Accounts */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Wallet Accounts</h3>
                {accounts.map((acc) => {
                  const details = accountDetails[acc.account];
                  const isSelected = selectedAccount?.account === acc.account && !selectedMT5;
                  
                  return (
                    <button
                      key={acc.account}
                      onClick={() => { setSelectedAccount(acc); setSelectedMT5(null); }}
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
              
              {/* MT5 Accounts */}
              {mt5Accounts.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    MT5 Trading Accounts
                  </h3>
                  {mt5Accounts.map((mt5) => {
                    const isSelected = selectedMT5?.login === mt5.login;
                    
                    return (
                      <button
                        key={mt5.login}
                        onClick={() => { setSelectedMT5(mt5); setSelectedAccount(accounts[0]); }}
                        className={`w-full p-4 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10">
                              <BarChart3 className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                MT5 {mt5.login}
                                <Badge variant="outline">{mt5.market_type}</Badge>
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  {mt5.server}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">
                                  {mt5.display_balance} {mt5.currency}
                                </span>
                                <span className="mx-2">•</span>
                                <span>Leverage 1:{mt5.leverage}</span>
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
              )}

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
