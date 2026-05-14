import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export default function DerivDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const callbackUrl = `${window.location.origin}/deriv-callback`;

  const copyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      toast.success('Callback URL copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const runDiagnostics = async () => {
    setRunning(true);
    const newResults: DiagnosticResult[] = [];

    // Test 1: Check origin URL
    newResults.push({
      name: 'Origin URL',
      status: 'success',
      message: window.location.origin,
    });
    setResults([...newResults]);

    // Test 2: Check callback URL format
    newResults.push({
      name: 'Callback URL',
      status: callbackUrl.startsWith('https://') || callbackUrl.includes('localhost') ? 'success' : 'error',
      message: callbackUrl,
    });
    setResults([...newResults]);

    // Test 3: Test Deriv WebSocket connection
    try {
      const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=90127');
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        };
      });

      newResults.push({
        name: 'Deriv WebSocket',
        status: 'success',
        message: 'Connected successfully',
      });
    } catch (err: any) {
      newResults.push({
        name: 'Deriv WebSocket',
        status: 'error',
        message: err.message || 'Connection failed',
      });
    }
    setResults([...newResults]);

    // Test 4: Check localStorage debug info
    const debugInfo = localStorage.getItem('deriv_callback_debug');
    if (debugInfo) {
      try {
        const parsed = JSON.parse(debugInfo);
        newResults.push({
          name: 'Last OAuth Attempt',
          status: 'success',
          message: `${parsed.timestamp || 'Unknown time'} - Found ${parsed.accountIds?.length || 0} accounts`,
        });
      } catch {
        newResults.push({
          name: 'Last OAuth Attempt',
          status: 'error',
          message: 'Invalid debug data',
        });
      }
    } else {
      newResults.push({
        name: 'Last OAuth Attempt',
        status: 'pending',
        message: 'No previous attempts recorded',
      });
    }
    setResults([...newResults]);

    // Test 5: Check for last error
    const lastError = localStorage.getItem('deriv_last_error');
    if (lastError) {
      try {
        const parsed = JSON.parse(lastError);
        newResults.push({
          name: 'Last Error',
          status: 'error',
          message: parsed.error || 'Unknown error',
        });
      } catch {
        newResults.push({
          name: 'Last Error',
          status: 'success',
          message: 'No errors recorded',
        });
      }
    } else {
      newResults.push({
        name: 'Last Error',
        status: 'success',
        message: 'No errors recorded',
      });
    }
    setResults([...newResults]);

    setRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Deriv Connection Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Callback URL Display */}
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="text-sm font-medium">Expected Callback URL:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto">
              {callbackUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyCallbackUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Register this URL in your Deriv app settings
          </p>
        </div>

        {/* Diagnostic Results */}
        <div className="space-y-2">
          {results.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2">
                {result.status === 'success' && <CheckCircle className="w-4 h-4 text-profit" />}
                {result.status === 'error' && <XCircle className="w-4 h-4 text-loss" />}
                {result.status === 'pending' && <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />}
                <span className="text-sm font-medium">{result.name}</span>
              </div>
              <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                {result.message.length > 40 ? result.message.slice(0, 40) + '...' : result.message}
              </Badge>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={runDiagnostics} disabled={running} variant="outline" size="sm">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Run Diagnostics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://app.deriv.com/account/api-token', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Deriv App Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
