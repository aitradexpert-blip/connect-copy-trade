// Deriv WebSocket Service - Connect to Deriv API for market data and trading
// Uses app_id 90127 for HuMi application

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = '90127';

type MessageHandler = (data: any) => void;
type SubscriptionCallback = (data: any) => void;

interface Subscription {
  id: string;
  callback: SubscriptionCallback;
}

export class DerivWS {
  private ws: WebSocket | null = null;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private requestId = 1;
  private isConnecting = false;
  private messageHandlers: Set<MessageHandler> = new Set();

  constructor(private appId: string = DERIV_APP_ID) {}

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkConnection = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          } else if (!this.isConnecting) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${DERIV_WS_URL}?app_id=${this.appId}`);

        this.ws.onopen = () => {
          console.log('[DerivWS] Connected to Deriv WebSocket');
          this.isConnecting = false;
          this.startPingInterval();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('[DerivWS] WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[DerivWS] Connection closed:', event.code, event.reason);
          this.isConnecting = false;
          this.stopPingInterval();
          this.handleDisconnect();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle errors
      if (message.error) {
        console.error('[DerivWS] API Error:', message.error.message, message.error.code);
        
        // Reject pending request if exists
        if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
          const { reject } = this.pendingRequests.get(String(message.req_id))!;
          this.pendingRequests.delete(String(message.req_id));
          reject(new Error(message.error.message));
        }
        return;
      }

      // Handle subscription updates
      if (message.subscription?.id) {
        const subId = message.subscription.id;
        if (this.subscriptions.has(subId)) {
          const sub = this.subscriptions.get(subId)!;
          sub.callback(message);
        }
      }

      // Resolve pending request
      if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
        const { resolve } = this.pendingRequests.get(String(message.req_id))!;
        this.pendingRequests.delete(String(message.req_id));
        resolve(message);
      }

      // Notify all message handlers
      this.messageHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error('[DerivWS] Error parsing message:', error);
    }
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive (Deriv closes idle connections after ~2 minutes)
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ ping: 1 }).catch(console.error);
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleDisconnect(): void {
    // Clear all subscriptions
    this.subscriptions.clear();
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }

  async disconnect(): Promise<void> {
    this.stopPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Forget all subscriptions before closing
    const forgetPromises = Array.from(this.subscriptions.keys()).map(id =>
      this.send({ forget: id }).catch(() => {})
    );
    await Promise.all(forgetPromises);
    
    this.subscriptions.clear();
    this.pendingRequests.clear();
    this.messageHandlers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async send<T = any>(payload: Record<string, any>): Promise<T> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const reqId = String(this.requestId++);
    const message = { ...payload, req_id: reqId };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      this.ws!.send(JSON.stringify(message));
    });
  }

  subscribe(
    payload: Record<string, any> & { subscribe: 1 },
    callback: SubscriptionCallback
  ): { forget: () => Promise<void> } {
    // Send subscription request
    this.send(payload)
      .then((response) => {
        if (response.subscription?.id) {
          this.subscriptions.set(response.subscription.id, {
            id: response.subscription.id,
            callback
          });
          // Call callback with initial response
          callback(response);
        }
      })
      .catch(console.error);

    return {
      forget: async () => {
        // Find and remove subscription
        for (const [id, sub] of this.subscriptions.entries()) {
          if (sub.callback === callback) {
            this.subscriptions.delete(id);
            await this.send({ forget: id }).catch(() => {});
            break;
          }
        }
      }
    };
  }

  addMessageHandler(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Symbol mapping: UI symbols to Deriv symbols
export const DERIV_SYMBOL_MAP: Record<string, string> = {
  // Major Forex Pairs
  'EUR/USD': 'frxEURUSD',
  'GBP/USD': 'frxGBPUSD',
  'USD/JPY': 'frxUSDJPY',
  'USD/CHF': 'frxUSDCHF',
  'AUD/USD': 'frxAUDUSD',
  'USD/CAD': 'frxUSDCAD',
  'NZD/USD': 'frxNZDUSD',
  'EUR/GBP': 'frxEURGBP',
  'EUR/JPY': 'frxEURJPY',
  'GBP/JPY': 'frxGBPJPY',
  'EUR/CHF': 'frxEURCHF',
  'AUD/JPY': 'frxAUDJPY',
  'GBP/CHF': 'frxGBPCHF',
  'EUR/AUD': 'frxEURAUD',
  'EUR/CAD': 'frxEURCAD',
  'AUD/CAD': 'frxAUDCAD',
  'CAD/JPY': 'frxCADJPY',
  'NZD/JPY': 'frxNZDJPY',
  'GBP/AUD': 'frxGBPAUD',
  'GBP/CAD': 'frxGBPCAD',
  'AUD/NZD': 'frxAUDNZD',
  'CHF/JPY': 'frxCHFJPY',
  'EUR/NZD': 'frxEURNZD',
  'GBP/NZD': 'frxGBPNZD',
  'NZD/CAD': 'frxNZDCAD',
  'NZD/CHF': 'frxNZDCHF',
  'AUD/CHF': 'frxAUDCHF',
  'CAD/CHF': 'frxCADCHF',
  
  // Metals
  'XAU/USD': 'frxXAUUSD',
  'XAG/USD': 'frxXAGUSD',
  
  // Crypto
  'BTC/USD': 'cryBTCUSD',
  'ETH/USD': 'cryETHUSD',
  'LTC/USD': 'cryLTCUSD',
  'XRP/USD': 'cryXRPUSD',
  'BCH/USD': 'cryBCHUSD',
  'EOS/USD': 'cryEOSUSD',
  'BNB/USD': 'cryBNBUSD',
  'DOGE/USD': 'cryDOGEUSD',
  'ADA/USD': 'cryADAUSD',
  'DOT/USD': 'cryDOTUSD',
  'SOL/USD': 'crySOLUSD',
  'LINK/USD': 'cryLINKUSD',
  'AVAX/USD': 'cryAVAXUSD',
  'MATIC/USD': 'cryMATICUSD',
  'UNI/USD': 'cryUNIUSD',
  
  // Synthetic Indices (Volatility Indices)
  'Volatility 10': '1HZ10V',
  'Volatility 25': '1HZ25V',
  'Volatility 50': '1HZ50V',
  'Volatility 75': '1HZ75V',
  'Volatility 100': '1HZ100V',
  'Volatility 10 (1s)': 'R_10',
  'Volatility 25 (1s)': 'R_25',
  'Volatility 50 (1s)': 'R_50',
  'Volatility 75 (1s)': 'R_75',
  'Volatility 100 (1s)': 'R_100',
  'Boom 300': 'BOOM300N',
  'Boom 500': 'BOOM500',
  'Boom 1000': 'BOOM1000',
  'Crash 300': 'CRASH300N',
  'Crash 500': 'CRASH500',
  'Crash 1000': 'CRASH1000',
  'Step Index': 'stpRNG',
  'Jump 10': 'JD10',
  'Jump 25': 'JD25',
  'Jump 50': 'JD50',
  'Jump 75': 'JD75',
  'Jump 100': 'JD100',
  
  // Indices
  'US 30': 'OTC_DJ30',
  'US30': 'OTC_DJ30',
  'US 500': 'OTC_SP500',
  'US500': 'OTC_SP500',
  'US Tech 100': 'OTC_NDX',
  'USTEC': 'OTC_NDX',
  'UK 100': 'OTC_FTSE',
  'UK100': 'OTC_FTSE',
  'Germany 40': 'OTC_GDAXI',
  'GER40': 'OTC_GDAXI',
  'Hong Kong 50': 'OTC_HSI',
  'Japan 225': 'OTC_N225',
  'JP225': 'OTC_N225',
  'France 40': 'OTC_FCHI',
  'Australia 200': 'OTC_AS51',
  'AUS200': 'OTC_AS51',
};

// Reverse mapping for lookups
export const DERIV_SYMBOL_REVERSE_MAP: Record<string, string> = Object.entries(DERIV_SYMBOL_MAP)
  .reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as Record<string, string>);

// Get Deriv symbol from UI symbol
export function getDerivSymbol(uiSymbol: string): string | null {
  // Direct match
  if (DERIV_SYMBOL_MAP[uiSymbol]) {
    return DERIV_SYMBOL_MAP[uiSymbol];
  }
  
  // Try normalized (remove spaces and slashes)
  const normalized = uiSymbol.replace(/[\s/]/g, '').toUpperCase();
  for (const [key, value] of Object.entries(DERIV_SYMBOL_MAP)) {
    if (key.replace(/[\s/]/g, '').toUpperCase() === normalized) {
      return value;
    }
  }
  
  return null;
}

// Get UI symbol from Deriv symbol
export function getUISymbol(derivSymbol: string): string | null {
  return DERIV_SYMBOL_REVERSE_MAP[derivSymbol] || null;
}

// Singleton instance for shared connection
let sharedInstance: DerivWS | null = null;

export function getSharedDerivWS(): DerivWS {
  if (!sharedInstance) {
    sharedInstance = new DerivWS();
  }
  return sharedInstance;
}

export function closeSharedDerivWS(): void {
  if (sharedInstance) {
    sharedInstance.disconnect();
    sharedInstance = null;
  }
}
