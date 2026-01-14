// Deriv Signal Execution Service
// Executes trading signals on Deriv accounts using WebSocket API

import { getSharedDerivWS, getDerivSymbol } from './derivWebSocket';
import { getProposal, buyContract, ProposalParams } from './derivTrading';

export interface SignalTradeParams {
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  comment?: string;
}

export interface DerivAccountInfo {
  deriv_token: string;
  deriv_currency?: string;
  is_virtual?: boolean;
}

/**
 * Map forex-style direction to Deriv contract types
 * BUY = Rising price expectation = CALL
 * SELL = Falling price expectation = PUT
 */
function mapDirectionToContractType(direction: 'BUY' | 'SELL'): 'CALL' | 'PUT' {
  return direction === 'BUY' ? 'CALL' : 'PUT';
}

/**
 * Determine the best duration settings based on symbol type
 * Different symbols support different duration types
 */
function getDurationForSymbol(derivSymbol: string): { duration: number; durationUnit: 't' | 's' | 'm' | 'h' | 'd' } {
  // Synthetic indices (Volatility, Boom, Crash, etc.) - support tick-based durations
  if (
    derivSymbol.startsWith('R_') || 
    derivSymbol.startsWith('1HZ') ||
    derivSymbol.includes('BOOM') ||
    derivSymbol.includes('CRASH') ||
    derivSymbol === 'stpRNG' ||
    derivSymbol.startsWith('JD')
  ) {
    return { duration: 5, durationUnit: 't' }; // 5 ticks
  }
  
  // Forex pairs (frx prefix) - use minutes, minimum typically 1-2 minutes
  if (derivSymbol.startsWith('frx')) {
    return { duration: 2, durationUnit: 'm' }; // 2 minutes
  }
  
  // Crypto - use minutes
  if (derivSymbol.startsWith('cry')) {
    return { duration: 5, durationUnit: 'm' }; // 5 minutes
  }
  
  // Indices (OTC prefix) - use minutes
  if (derivSymbol.startsWith('OTC')) {
    return { duration: 5, durationUnit: 'm' }; // 5 minutes
  }
  
  // Default fallback - 5 ticks works for most synthetics
  return { duration: 5, durationUnit: 't' };
}

/**
 * Execute a trading signal on a Deriv account
 * Uses the proposal/buy flow for Rise/Fall contracts
 */
export async function executeDerivSignal(
  account: DerivAccountInfo,
  signal: SignalTradeParams
): Promise<{
  success: boolean;
  contractId?: number;
  buyPrice?: number;
  payout?: number;
  error?: string;
}> {
  const ws = getSharedDerivWS();
  
  try {
    // Step 1: Authorize with the account token
    console.log('[DerivSignalExecution] Authorizing account...');
    const authResponse = await ws.send({
      authorize: account.deriv_token,
    });
    
    if (authResponse.error) {
      throw new Error(`Authorization failed: ${authResponse.error.message}`);
    }
    
    console.log('[DerivSignalExecution] Authorized as:', authResponse.authorize?.loginid);
    
    // Step 2: Map symbol to Deriv format
    const derivSymbol = getDerivSymbol(signal.symbol) || signal.symbol;
    console.log('[DerivSignalExecution] Symbol mapping:', signal.symbol, '->', derivSymbol);
    
    // Step 3: Calculate stake based on volume
    // For Deriv options, we use the volume as stake amount in the account currency
    // Typical lot sizes in forex (0.01 = micro lot) map to small stakes
    const stake = Math.max(1, signal.volume * 100); // Convert lot size to stake (e.g., 0.01 lot = $1 stake)
    
    // Step 4: Get duration settings based on symbol type
    const { duration, durationUnit } = getDurationForSymbol(derivSymbol);
    console.log('[DerivSignalExecution] Duration settings:', duration, durationUnit, 'for symbol:', derivSymbol);
    
    // Step 5: Get proposal for Rise/Fall contract
    const contractType = mapDirectionToContractType(signal.direction);
    
    const proposalParams: ProposalParams = {
      symbol: derivSymbol,
      contractType: contractType,
      amount: stake,
      basis: 'stake',
      duration: duration,
      durationUnit: durationUnit,
    };
    
    console.log('[DerivSignalExecution] Getting proposal:', proposalParams);
    const proposalResponse = await getProposal(proposalParams, ws);
    
    if (!proposalResponse.proposal?.id) {
      throw new Error('Failed to get proposal quote');
    }
    
    console.log('[DerivSignalExecution] Proposal received:', {
      id: proposalResponse.proposal.id,
      askPrice: proposalResponse.proposal.ask_price,
      payout: proposalResponse.proposal.payout,
    });
    
    // Step 6: Execute the buy
    const buyResponse = await buyContract(
      proposalResponse.proposal.id,
      proposalResponse.proposal.ask_price,
      ws
    );
    
    console.log('[DerivSignalExecution] Contract purchased:', {
      contractId: buyResponse.buy.contract_id,
      buyPrice: buyResponse.buy.buy_price,
      payout: buyResponse.buy.payout,
    });
    
    return {
      success: true,
      contractId: buyResponse.buy.contract_id,
      buyPrice: buyResponse.buy.buy_price,
      payout: buyResponse.buy.payout,
    };
    
  } catch (error: any) {
    console.error('[DerivSignalExecution] Trade execution failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute trade',
    };
  }
}
