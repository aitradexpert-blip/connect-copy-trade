// Deriv Trade Execution Edge Function
// Executes trades on Deriv accounts via WebSocket API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deriv WebSocket connection helper
class DerivWS {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<number, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private reqId = 0;

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=90127');
      
      this.ws.onopen = () => {
        console.log('[DerivWS] Connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('[DerivWS] Connection error:', error);
        reject(new Error('WebSocket connection failed'));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const reqId = data.req_id;
          if (reqId && this.pendingRequests.has(reqId)) {
            const { resolve } = this.pendingRequests.get(reqId)!;
            this.pendingRequests.delete(reqId);
            resolve(data);
          }
        } catch (err) {
          console.error('[DerivWS] Parse error:', err);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[DerivWS] Disconnected');
      };
    });
  }

  async send<T = any>(payload: Record<string, any>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const reqId = ++this.reqId;
      this.pendingRequests.set(reqId, { resolve, reject });
      
      const message = { ...payload, req_id: reqId };
      this.ws!.send(JSON.stringify(message));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Symbol mapping: UI symbols to Deriv format
const SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'frxEURUSD',
  'GBP/USD': 'frxGBPUSD',
  'USD/JPY': 'frxUSDJPY',
  'AUD/USD': 'frxAUDUSD',
  'USD/CHF': 'frxUSDCHF',
  'NZD/USD': 'frxNZDUSD',
  'USD/CAD': 'frxUSDCAD',
  'GBP/JPY': 'frxGBPJPY',
  'EUR/GBP': 'frxEURGBP',
  'EUR/JPY': 'frxEURJPY',
  'XAU/USD': 'frxXAUUSD',
  'BTC/USD': 'cryBTCUSD',
  'ETH/USD': 'cryETHUSD',
};

function getDerivSymbol(uiSymbol: string): string {
  return SYMBOL_MAP[uiSymbol] || uiSymbol;
}

// Get appropriate duration based on symbol type
function getDurationForSymbol(derivSymbol: string): { duration: number; durationUnit: string } {
  // Synthetic indices support ticks
  if (
    derivSymbol.startsWith('R_') || 
    derivSymbol.startsWith('1HZ') ||
    derivSymbol.includes('BOOM') ||
    derivSymbol.includes('CRASH') ||
    derivSymbol === 'stpRNG' ||
    derivSymbol.startsWith('JD') ||
    derivSymbol.startsWith('RDBEAR') ||
    derivSymbol.startsWith('RDBULL')
  ) {
    return { duration: 5, durationUnit: 't' }; // 5 ticks
  }
  
  // Forex, crypto, metals, OTC - use 15 minutes (minimum required for these assets)
  return { duration: 15, durationUnit: 'm' }; // 15 minutes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ws = new DerivWS();
  
  try {
    const { deriv_token, deriv_currency, is_virtual, signal } = await req.json();

    if (!deriv_token) {
      return new Response(
        JSON.stringify({ error: 'deriv_token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!signal || !signal.symbol || !signal.direction) {
      return new Response(
        JSON.stringify({ error: 'Invalid signal parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DerivExecute] Executing signal:', signal);
    console.log('[DerivExecute] Account:', { is_virtual, currency: deriv_currency });

    // Connect to Deriv
    await ws.connect();
    
    // Authorize
    const authResponse = await ws.send({ authorize: deriv_token });
    if (authResponse.error) {
      throw new Error(`Authorization failed: ${authResponse.error.message}`);
    }
    console.log('[DerivExecute] Authorized as:', authResponse.authorize?.loginid);

    // Map symbol to Deriv format
    const derivSymbol = getDerivSymbol(signal.symbol);
    console.log('[DerivExecute] Symbol mapping:', signal.symbol, '->', derivSymbol);

    // Calculate stake from lot size
    const stake = Math.max(1, (signal.lot_size || 0.01) * 100);
    
    // Get duration settings
    const { duration, durationUnit } = getDurationForSymbol(derivSymbol);
    
    // Map direction to contract type
    const contractType = signal.direction === 'BUY' ? 'CALL' : 'PUT';

    // Get proposal
    const proposalResponse = await ws.send({
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency: deriv_currency || 'USD',
      duration: duration,
      duration_unit: durationUnit,
      symbol: derivSymbol,
    });

    if (proposalResponse.error) {
      throw new Error(`Proposal failed: ${proposalResponse.error.message}`);
    }

    if (!proposalResponse.proposal?.id) {
      throw new Error('Failed to get proposal quote');
    }

    console.log('[DerivExecute] Proposal received:', {
      id: proposalResponse.proposal.id,
      askPrice: proposalResponse.proposal.ask_price,
      payout: proposalResponse.proposal.payout,
    });

    // Execute buy
    const buyResponse = await ws.send({
      buy: proposalResponse.proposal.id,
      price: proposalResponse.proposal.ask_price,
    });

    if (buyResponse.error) {
      throw new Error(`Buy failed: ${buyResponse.error.message}`);
    }

    console.log('[DerivExecute] Contract purchased:', {
      contractId: buyResponse.buy.contract_id,
      buyPrice: buyResponse.buy.buy_price,
      payout: buyResponse.buy.payout,
    });

    ws.close();

    return new Response(
      JSON.stringify({
        success: true,
        contract_id: buyResponse.buy.contract_id,
        buy_price: buyResponse.buy.buy_price,
        payout: buyResponse.buy.payout,
        symbol: derivSymbol,
        direction: signal.direction,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[DerivExecute] Error:', error);
    ws.close();
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Trade execution failed' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
