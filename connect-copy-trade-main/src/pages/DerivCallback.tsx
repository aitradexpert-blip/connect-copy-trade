import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseDerivRedirectTokens, isVirtualAccount, getAccountTypeLabel, isWalletAccount, canTradeViaAPI, DerivAccount, wasOAuthRecentlyInitiated, clearOAuthState } from "@/services/derivAuth";
import { authorizeDerivAccount, getMT5AccountList, MT5Account } from "@/services/derivBroker";
import { Loader2, Check, AlertCircle, Wallet, RefreshCw, BarChart3, Info, ExternalLink, AlertTriangle, Copy, Key } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateDerivToken } from "@/services/derivAuth";

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

// Account from authorize response's account_list
interface DiscoveredAccount {
  loginid: string;
  currency: string;
  is_virtual: boolean;
  account_type: string; // "trading" or "wallet"
  can_trade: boolean;
}

export default function DerivCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const mountedRef = useRef(true);
  const processedRef = useRef(false);
  
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState<Record<string, any>>({});
  const [mt5Accounts, setMT5Accounts] = useState<MT5Account[]>([]);
  const [selectedMT5, setSelectedMT5] = useState<MT5Account | null>(null);
  const [correlationId] = useState(() => `cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualLoginId, setManualLoginId] = useState('');
  const [isRedirectLoop, setIsRedirectLoop] = useState(false);

  // Store tokens if user needs to log in first
  useEffect(() => {
    if (!authLoading && !user) {
      // Store the current URL with tokens for after login
      const currentUrl = window.location.href;
      if (location.search.includes('token1') || location.hash.includes('token1')) {
        sessionStorage.setItem('deriv_pending_redirect', currentUrl);
        setNeedsLogin(true);
      }
    }
  }, [authLoading, user, location.search, location.hash]);

  useEffect(() => {
    // Don't process if already processed or auth still loading
    if (processedRef.current || authLoading) return;
    
    mountedRef.current = true;
    
    // ========== STEP 1: Log the full redirect URL ==========
    const expectedCallback = sessionStorage.getItem('deriv_expected_callback') || `${window.location.origin}/deriv-callback`;
    
    console.log("=".repeat(60));
    console.log("[Deriv OAuth] STEP 1: Processing OAuth Redirect");
    console.log("[Deriv OAuth] Full Returned URL:", window.location.href);
    console.log("[Deriv OAuth] Query String:", location.search);
    console.log("[Deriv OAuth] Hash Fragment:", location.hash);
    console.log("[Deriv OAuth] Expected Callback:", expectedCallback);
    console.log("[Deriv OAuth] Correlation ID:", correlationId);
    console.log("[Deriv OAuth] User logged in:", !!user);
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
      expectedCallback,
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
      // Check if this is an OAuth redirect loop (no tokens = URL not registered)
      const oauthWasInitiated = wasOAuthRecentlyInitiated();
      const hasNoTokens = !location.search.includes('token') && !location.hash.includes('token');
      const redirectLoopDetected = oauthWasInitiated && hasNoTokens;
      
      console.log("[Deriv OAuth] No tokens found. OAuth initiated:", oauthWasInitiated, "Has tokens:", !hasNoTokens);
      
      if (redirectLoopDetected) {
        setIsRedirectLoop(true);
        setShowManualEntry(true);
        clearOAuthState();
        // Don't set error - show the manual entry form instead
        return;
      }
      
      const errorMsg = "No accounts found in redirect. You may have cancelled the authorization or the URL is not registered.";
      setError(errorMsg);
      return;
    }
    
    // Clear OAuth state on successful token detection
    clearOAuthState();
    
    if (!mountedRef.current) return;
    setAccounts(parsed);
    processedRef.current = true;
    
    // Auto-select if only one account
    if (parsed.length === 1) {
      setSelectedAccount(parsed[0]);
    }
    
    // ========== STEP 2: Authorize with WebSocket ==========
    console.log("=".repeat(60));
    console.log("[Deriv OAuth] STEP 2: WebSocket Authorization");
    console.log("=".repeat(60));
    
    // Authorize first account and fetch MT5 accounts + discover trading accounts
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
          
          // Extract trading accounts from account_list (these are CR accounts that can trade)
          if (authResponse.authorize?.account_list) {
            const tradingAccounts = authResponse.authorize.account_list
              .filter((a: any) => a.account_type === 'trading')
              .map((a: any) => ({
                loginid: a.loginid,
                currency: a.currency,
                is_virtual: a.is_virtual === 1,
                account_type: a.account_type,
                can_trade: true,
              }));
            
            console.log("[Deriv WS] Discovered trading accounts:", tradingAccounts);
            if (mountedRef.current && tradingAccounts.length > 0) {
              setDiscoveredAccounts(prev => {
                const existing = new Set(prev.map(a => a.loginid));
                const newAccounts = tradingAccounts.filter((a: DiscoveredAccount) => !existing.has(a.loginid));
                return [...prev, ...newAccounts];
              });
            }
          }
          
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
  }, [location.search, location.hash, correlationId, user?.id, authLoading]);

  // Handle manual token connection
  const handleManualConnect = async () => {
    if (!user || !manualToken) {
      toast({ title: "Please enter your API Token", variant: "destructive" });
      return;
    }

    setIsConnecting(true);
    try {
      const result = await validateDerivToken(manualToken);
      
      if (!result.valid) {
        toast({ title: "Invalid token", description: result.error, variant: "destructive" });
        setIsConnecting(false);
        return;
      }

      // Save account to database
      const { error: upsertError } = await supabase.from("trading_accounts").upsert({
        user_id: user.id,
        provider: 'deriv',
        provider_account_id: result.accountInfo!.loginid,
        name: `Deriv ${result.accountInfo!.is_virtual ? 'Demo' : 'Real'} (${result.accountInfo!.currency})`,
        login: result.accountInfo!.loginid,
        platform: 'deriv',
        server: 'deriv.com',
        deriv_token: manualToken,
        deriv_currency: result.accountInfo!.currency,
        is_virtual: result.accountInfo!.is_virtual,
        balance: result.accountInfo!.balance,
        equity: result.accountInfo!.balance,
        connection_status: 'connected',
      }, {
        onConflict: 'user_id,provider,provider_account_id',
      });

      if (upsertError) throw upsertError;

      toast({ title: "Account connected!", description: `${result.accountInfo!.loginid} added successfully` });
      navigate('/accounts');
    } catch (err: any) {
      toast({ title: "Failed to save account", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

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

  // Show manual entry when redirect loop detected OR error state
  if (showManualEntry || isRedirectLoop) {
    const callbackUrl = sessionStorage.getItem('deriv_expected_callback') || `${window.location.origin}/deriv-callback`;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Connect Deriv Account
            </CardTitle>
            <CardDescription>
              {isRedirectLoop 
                ? "OAuth redirect not working - use manual token entry instead"
                : "Enter your Deriv API token to connect"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRedirectLoop && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-600 dark:text-amber-400">OAuth Redirect Issue Detected</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The redirect URL may not be registered correctly in your Deriv app settings.
                    </p>
                  </div>
                </div>
                
                <div className="text-sm space-y-2">
                  <p className="font-medium">To fix OAuth (optional):</p>
                  <ol className="text-muted-foreground space-y-1 text-xs">
                    <li>1. Go to <a href="https://api.deriv.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Deriv API Dashboard</a></li>
                    <li>2. Edit app ID 90127 → Set Redirect URL to:</li>
                  </ol>
                  <div className="flex items-center gap-2 bg-background rounded p-2 border">
                    <code className="text-xs flex-1 break-all">{callbackUrl}</code>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(callbackUrl);
                        toast({ title: "Copied!" });
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Manual Token Entry</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">1.</span>
                  Go to{' '}
                  <a 
                    href="https://app.deriv.com/account/api-token" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Deriv API Token page <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">2.</span>
                  Create token with "Read", "Trade", "Admin" permissions
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">3.</span>
                  Use a CR account (not CRW wallet) for trading
                </li>
              </ol>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="manualLoginId">Login ID (e.g., CR1234567)</Label>
                <Input
                  id="manualLoginId"
                  placeholder="CR1234567"
                  value={manualLoginId}
                  onChange={(e) => setManualLoginId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualToken">API Token</Label>
                <Input
                  id="manualToken"
                  type="password"
                  placeholder="Paste your API token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
              </div>
            </div>

            {!user && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  You need to be logged in to connect an account.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/accounts')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleManualConnect} 
                disabled={isConnecting || !manualToken || !user}
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
            
            {!isRedirectLoop && (
              <button
                onClick={() => {
                  setShowManualEntry(false);
                  window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=90127&l=en&brand=deriv`;
                }}
                className="w-full text-xs text-muted-foreground hover:text-primary underline"
              >
                Try OAuth again
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground whitespace-pre-line">{error}</p>
            
            <p className="text-xs text-muted-foreground">
              Correlation ID: {correlationId}
            </p>
            
            <div className="flex gap-2">
              <Button onClick={() => navigate('/accounts')} className="flex-1" variant="outline">
                Back to Accounts
              </Button>
              <Button 
                onClick={() => setShowManualEntry(true)} 
                className="flex-1"
              >
                <Key className="w-4 h-4 mr-2" />
                Try Manual Entry
              </Button>
            </div>
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
          {/* User needs to log in first */}
          {needsLogin && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-500">Login Required</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please log in to your HuMi account first, then connect your Deriv account.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Log In to Continue
              </Button>
            </div>
          )}
          
          {!needsLogin && accounts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !needsLogin && (
            <>
              {/* Info about wallet vs trading accounts */}
              {accounts.some(a => isWalletAccount(a.account)) && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-amber-600 dark:text-amber-400">Important:</span>{' '}
                      <span className="font-medium">Wallet accounts (CRW/VRW)</span> cannot trade via API - they are for deposits/withdrawals only. 
                      For API trading, you need a <span className="font-medium">Trading account (CR/VRTC)</span>.
                      {discoveredAccounts.length === 0 && (
                        <span className="block mt-1">
                          To get a trading account, visit{' '}
                          <a 
                            href="https://app.deriv.com/traders-hub" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Deriv Traders Hub <ExternalLink className="w-3 h-3" />
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Available Accounts */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Available Accounts</h3>
                {accounts.map((acc) => {
                  const details = accountDetails[acc.account];
                  const isSelected = selectedAccount?.account === acc.account && !selectedMT5;
                  const isWallet = isWalletAccount(acc.account);
                  const tradeable = canTradeViaAPI(acc.account);
                  
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
                            isWallet 
                              ? 'bg-amber-500/10' 
                              : isVirtualAccount(acc.account) 
                                ? 'bg-yellow-500/10' 
                                : 'bg-green-500/10'
                          }`}>
                            <Wallet className={`w-5 h-5 ${
                              isWallet 
                                ? 'text-amber-500' 
                                : isVirtualAccount(acc.account) 
                                  ? 'text-yellow-500' 
                                  : 'text-green-500'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              {acc.account}
                              <Badge variant={isVirtualAccount(acc.account) ? "secondary" : "default"}>
                                {getAccountTypeLabel(acc.account)}
                              </Badge>
                              {tradeable ? (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
                                  Can Trade
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                                  Wallet Only
                                </Badge>
                              )}
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
                              <div className="font-medium flex items-center gap-2 flex-wrap">
                                MT5 {mt5.login}
                                <Badge variant="outline">{mt5.market_type}</Badge>
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  {mt5.server}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                                  Display Only
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">
                                  {mt5.display_balance} {mt5.currency}
                                </span>
                                <span className="mx-2">•</span>
                                <span>Leverage 1:{mt5.leverage}</span>
                              </div>
                              <div className="text-xs text-amber-600 mt-1">
                                MT5 trading not supported via Deriv API - use MetaTrader 5 app
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
