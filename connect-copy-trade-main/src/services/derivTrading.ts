// Deriv Trading Service
// Handles trading operations: proposal quotes, buy contracts, subscribe to open contracts, sell

import { getSharedDerivWS, DerivWS, getDerivSymbol } from './derivWebSocket';

export interface ProposalParams {
  symbol: string;
  contractType: 'CALL' | 'PUT' | 'DIGITOVER' | 'DIGITUNDER' | 'TOUCH' | 'NOTOUCH';
  amount: number;
  basis: 'stake' | 'payout';
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  barrier?: string;
}

export interface ProposalResponse {
  proposal: {
    id: string;
    ask_price: number;
    display_value: string;
    payout: number;
    spot: number;
    spot_time: number;
    date_start: number;
    date_expiry: number;
    longcode: string;
  };
  subscription?: {
    id: string;
  };
}

export interface BuyResponse {
  buy: {
    balance_after: number;
    buy_price: number;
    contract_id: number;
    longcode: string;
    payout: number;
    purchase_time: number;
    shortcode: string;
    start_time: number;
    transaction_id: number;
  };
}

export interface OpenContractResponse {
  proposal_open_contract: {
    contract_id: number;
    status: 'open' | 'sold' | 'won' | 'lost' | 'cancelled';
    profit: number;
    profit_percentage: number;
    current_spot: number;
    current_spot_time: number;
    entry_spot: number;
    is_sold: number;
    is_valid_to_sell: number;
    sell_price?: number;
    sell_spot?: number;
    sell_time?: number;
    buy_price: number;
    payout: number;
    currency: string;
    date_expiry: number;
    date_start: number;
    longcode: string;
  };
}

export interface SellResponse {
  sell: {
    balance_after: number;
    contract_id: number;
    reference_id: number;
    sold_for: number;
    transaction_id: number;
  };
}

/**
 * Get a price proposal (quote) for a contract
 * Returns real-time updated proposal via subscription
 */
export async function getProposal(
  params: ProposalParams,
  ws?: DerivWS
): Promise<ProposalResponse> {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(params.symbol) || params.symbol;
  
  try {
    const response = await client.send({
      proposal: 1,
      amount: params.amount,
      basis: params.basis,
      contract_type: params.contractType,
      currency: 'USD',
      duration: params.duration,
      duration_unit: params.durationUnit,
      symbol: derivSymbol,
      barrier: params.barrier,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as ProposalResponse;
  } catch (error) {
    console.error('[DerivTrading] Get proposal failed:', error);
    throw error;
  }
}

/**
 * Subscribe to live proposal updates
 */
export function subscribeProposal(
  params: ProposalParams,
  onUpdate: (proposal: ProposalResponse['proposal']) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(params.symbol) || params.symbol;
  
  const subscription = client.subscribe(
    {
      proposal: 1,
      subscribe: 1,
      amount: params.amount,
      basis: params.basis,
      contract_type: params.contractType,
      currency: 'USD',
      duration: params.duration,
      duration_unit: params.durationUnit,
      symbol: derivSymbol,
      barrier: params.barrier,
    },
    (message) => {
      if (message.msg_type === 'proposal' && message.proposal) {
        onUpdate(message.proposal);
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}

/**
 * Buy a contract using a proposal ID
 */
export async function buyContract(
  proposalId: string,
  price: number,
  ws?: DerivWS
): Promise<BuyResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      buy: proposalId,
      price: price,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as BuyResponse;
  } catch (error) {
    console.error('[DerivTrading] Buy contract failed:', error);
    throw error;
  }
}

/**
 * Subscribe to open contract updates
 */
export function subscribeOpenContract(
  contractId: number,
  onUpdate: (contract: OpenContractResponse['proposal_open_contract']) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  
  const subscription = client.subscribe(
    {
      proposal_open_contract: 1,
      subscribe: 1,
      contract_id: contractId,
    },
    (message) => {
      if (message.msg_type === 'proposal_open_contract' && message.proposal_open_contract) {
        onUpdate(message.proposal_open_contract);
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}

/**
 * Sell an open contract early
 */
export async function sellContract(
  contractId: number,
  price?: number,
  ws?: DerivWS
): Promise<SellResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      sell: contractId,
      price: price || 0, // 0 means sell at market price
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as SellResponse;
  } catch (error) {
    console.error('[DerivTrading] Sell contract failed:', error);
    throw error;
  }
}

/**
 * Get all open contracts for the authorized account
 */
export async function getPortfolio(ws?: DerivWS): Promise<{
  contracts: Array<{
    contract_id: number;
    contract_type: string;
    currency: string;
    buy_price: number;
    payout: number;
    symbol: string;
    expiry_time: number;
  }>;
}> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ portfolio: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return {
      contracts: response.portfolio?.contracts || []
    };
  } catch (error) {
    console.error('[DerivTrading] Get portfolio failed:', error);
    throw error;
  }
}
