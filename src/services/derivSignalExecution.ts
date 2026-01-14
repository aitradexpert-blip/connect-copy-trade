// Deriv Signal Execution Service
// Executes trading signals on Deriv accounts using WebSocket API

import { getSharedDerivWS, getDerivSymbol, DerivWS } from './derivWebSocket';
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
    
    // Step 4: Get proposal for Rise/Fall contract
    const contractType = mapDirectionToContractType(signal.direction);
    
    const proposalParams: ProposalParams = {
      symbol: derivSymbol,
      contractType: contractType,
      amount: stake,
      basis: 'stake',
      duration: 5, // 5 minutes default duration
      durationUnit: 'm',
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
    
    // Step 5: Execute the buy
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
