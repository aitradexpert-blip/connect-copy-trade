import { supabase } from '@/integrations/supabase/client';

// Subscription tier transfer limits
export const TRANSFER_LIMITS = {
  basic: {
    dailyAmount: 2000,
    feeDeposit: 1.0, // percentage
    feeWithdraw: 1.5,
    feeCrossBroker: 2.0,
    feeInternal: 0
  },
  professional: {
    dailyAmount: 10000,
    feeDeposit: 0.5,
    feeWithdraw: 1.0,
    feeCrossBroker: 1.0,
    feeInternal: 0
  },
  enterprise: {
    dailyAmount: 50000,
    feeDeposit: 0.25,
    feeWithdraw: 0.5,
    feeCrossBroker: 0.75,
    feeInternal: 0
  }
};

export type TransferType = 'deposit_to_broker' | 'withdraw_to_wallet' | 'internal' | 'cross_broker';
export type TransferStatus = 'pending' | 'processing' | 'step1_complete' | 'step2_processing' | 'completed' | 'failed' | 'cancelled';

export interface TransferRequest {
  type: TransferType;
  sourceType: 'bankii_wallet' | 'broker_account';
  sourceId: string;
  sourceName?: string;
  destType: 'bankii_wallet' | 'broker_account';
  destId: string;
  destName?: string;
  amount: number;
  currency?: string;
}

export interface Transfer {
  id: string;
  user_id: string;
  transfer_type: TransferType;
  source_type: string;
  source_id: string;
  source_name?: string;
  dest_type: string;
  dest_id: string;
  dest_name?: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  status: TransferStatus;
  current_step: number;
  total_steps: number;
  step_details: Record<string, any>;
  deposit_address?: string;
  transaction_hash?: string;
  error_message?: string;
  estimated_completion_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

class TransferOrchestrator {
  // Calculate fee based on subscription tier
  calculateFee(amount: number, transferType: TransferType, subscriptionTier: string = 'basic'): number {
    const tier = TRANSFER_LIMITS[subscriptionTier as keyof typeof TRANSFER_LIMITS] || TRANSFER_LIMITS.basic;
    
    let feePercentage = 0;
    switch (transferType) {
      case 'deposit_to_broker':
        feePercentage = tier.feeDeposit;
        break;
      case 'withdraw_to_wallet':
        feePercentage = tier.feeWithdraw;
        break;
      case 'cross_broker':
        feePercentage = tier.feeCrossBroker;
        break;
      case 'internal':
        feePercentage = tier.feeInternal;
        break;
    }
    
    return (amount * feePercentage) / 100;
  }

  // Check daily transfer limit
  async checkDailyLimit(userId: string, amount: number, subscriptionTier: string = 'basic'): Promise<boolean> {
    const tier = TRANSFER_LIMITS[subscriptionTier as keyof typeof TRANSFER_LIMITS] || TRANSFER_LIMITS.basic;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: transfers } = await supabase
      .from('fund_transfers')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .neq('status', 'failed')
      .neq('status', 'cancelled');
    
    const todayTotal = (transfers || []).reduce((sum, t) => sum + Number(t.amount), 0);
    return (todayTotal + amount) <= tier.dailyAmount;
  }

  // Get user's subscription tier
  async getUserTier(userId: string): Promise<string> {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan_name')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    
    return data?.plan_name || 'basic';
  }

  // Create a new transfer
  async createTransfer(userId: string, request: TransferRequest): Promise<Transfer | null> {
    const tier = await this.getUserTier(userId);
    const fee = this.calculateFee(request.amount, request.type, tier);
    const netAmount = request.amount - fee;
    
    // Check daily limit
    const withinLimit = await this.checkDailyLimit(userId, request.amount, tier);
    if (!withinLimit) {
      throw new Error('Daily transfer limit exceeded');
    }
    
    // Determine total steps based on transfer type
    const totalSteps = request.type === 'cross_broker' ? 2 : 1;
    
    // Estimate completion time
    const estimatedMinutes = request.type === 'cross_broker' ? 30 : 
                            request.type === 'internal' ? 1 : 15;
    const estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60 * 1000);
    
    const { data, error } = await supabase
      .from('fund_transfers')
      .insert({
        user_id: userId,
        transfer_type: request.type,
        source_type: request.sourceType,
        source_id: request.sourceId,
        source_name: request.sourceName,
        dest_type: request.destType,
        dest_id: request.destId,
        dest_name: request.destName,
        amount: request.amount,
        fee,
        net_amount: netAmount,
        currency: request.currency || 'USDT',
        status: 'pending',
        current_step: 1,
        total_steps: totalSteps,
        step_details: {},
        estimated_completion_at: estimatedCompletion.toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
    
    return data as Transfer;
  }

  // Update transfer status
  async updateTransferStatus(
    transferId: string, 
    status: TransferStatus, 
    stepDetails?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const updates: Record<string, any> = { status };
    
    if (stepDetails) {
      updates.step_details = stepDetails;
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    
    if (status === 'step1_complete') {
      updates.current_step = 2;
    }
    
    const { error } = await supabase
      .from('fund_transfers')
      .update(updates)
      .eq('id', transferId);
    
    if (error) {
      console.error('Error updating transfer status:', error);
      throw error;
    }
  }

  // Get transfer by ID
  async getTransfer(transferId: string): Promise<Transfer | null> {
    const { data, error } = await supabase
      .from('fund_transfers')
      .select('*')
      .eq('id', transferId)
      .single();
    
    if (error) {
      console.error('Error fetching transfer:', error);
      return null;
    }
    
    return data as Transfer;
  }

  // Get user's transfers
  async getUserTransfers(userId: string, limit: number = 20): Promise<Transfer[]> {
    const { data, error } = await supabase
      .from('fund_transfers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching transfers:', error);
      return [];
    }
    
    return (data || []) as Transfer[];
  }

  // Get pending transfers for admin monitoring
  async getPendingTransfers(): Promise<Transfer[]> {
    const { data, error } = await supabase
      .from('fund_transfers')
      .select('*')
      .in('status', ['pending', 'processing', 'step1_complete', 'step2_processing'])
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching pending transfers:', error);
      return [];
    }
    
    return (data || []) as Transfer[];
  }

  // Flow 1: Deposit to Broker (Wallet → Broker)
  async depositToBroker(userId: string, brokerId: string, brokerName: string, amount: number): Promise<Transfer | null> {
    const transfer = await this.createTransfer(userId, {
      type: 'deposit_to_broker',
      sourceType: 'bankii_wallet',
      sourceId: 'bankii',
      sourceName: 'Bankii Wallet',
      destType: 'broker_account',
      destId: brokerId,
      destName: brokerName,
      amount
    });
    
    if (transfer) {
      // Get broker deposit address
      const depositAddress = await this.getBrokerDepositAddress(userId, brokerId, brokerName);
      
      if (depositAddress) {
        await supabase
          .from('fund_transfers')
          .update({ deposit_address: depositAddress })
          .eq('id', transfer.id);
        
        transfer.deposit_address = depositAddress;
      }
      
      await this.updateTransferStatus(transfer.id, 'processing', {
        step1: 'Awaiting USDT deposit to broker address'
      });
    }
    
    return transfer;
  }

  // Flow 2: Withdraw from Broker (Broker → Wallet)
  async withdrawToWallet(userId: string, brokerId: string, brokerName: string, amount: number): Promise<Transfer | null> {
    const transfer = await this.createTransfer(userId, {
      type: 'withdraw_to_wallet',
      sourceType: 'broker_account',
      sourceId: brokerId,
      sourceName: brokerName,
      destType: 'bankii_wallet',
      destId: 'bankii',
      destName: 'Bankii Wallet',
      amount
    });
    
    if (transfer) {
      // Get user's Bankii deposit address
      const bankiiAddress = await this.getBankiiDepositAddress(userId);
      
      if (bankiiAddress) {
        await supabase
          .from('fund_transfers')
          .update({ deposit_address: bankiiAddress })
          .eq('id', transfer.id);
        
        transfer.deposit_address = bankiiAddress;
      }
      
      await this.updateTransferStatus(transfer.id, 'processing', {
        step1: 'Initiating withdrawal from broker'
      });
    }
    
    return transfer;
  }

  // Flow 3: Internal Transfer (Same Broker)
  async internalTransfer(
    userId: string, 
    sourceAccountId: string, 
    sourceAccountName: string,
    destAccountId: string, 
    destAccountName: string,
    amount: number
  ): Promise<Transfer | null> {
    const transfer = await this.createTransfer(userId, {
      type: 'internal',
      sourceType: 'broker_account',
      sourceId: sourceAccountId,
      sourceName: sourceAccountName,
      destType: 'broker_account',
      destId: destAccountId,
      destName: destAccountName,
      amount
    });
    
    if (transfer) {
      await this.updateTransferStatus(transfer.id, 'processing', {
        step1: 'Processing internal transfer'
      });
      
      // Internal transfers are instant - mark as completed
      // In production, call MetaAPI internal transfer endpoint
      setTimeout(async () => {
        await this.updateTransferStatus(transfer.id, 'completed', {
          step1: 'Internal transfer completed'
        });
      }, 2000);
    }
    
    return transfer;
  }

  // Flow 4: Cross-Broker Transfer (Auto Bridge: Broker A → Wallet → Broker B)
  async crossBrokerTransfer(
    userId: string, 
    sourceAccountId: string,
    sourceAccountName: string, 
    destAccountId: string,
    destAccountName: string,
    amount: number
  ): Promise<Transfer | null> {
    const transfer = await this.createTransfer(userId, {
      type: 'cross_broker',
      sourceType: 'broker_account',
      sourceId: sourceAccountId,
      sourceName: sourceAccountName,
      destType: 'broker_account',
      destId: destAccountId,
      destName: destAccountName,
      amount
    });
    
    if (transfer) {
      await this.updateTransferStatus(transfer.id, 'processing', {
        step1: 'Withdrawing from source broker',
        step2: 'Pending - will deposit to destination broker'
      });
    }
    
    return transfer;
  }

  // Get cached broker deposit address or fetch new one
  private async getBrokerDepositAddress(userId: string, accountId: string, brokerName: string): Promise<string | null> {
    // Check cache first
    const { data: cached } = await supabase
      .from('broker_deposit_addresses')
      .select('address, expires_at')
      .eq('trading_account_id', accountId)
      .eq('currency', 'USDT')
      .maybeSingle();
    
    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.address;
    }
    
    // In production, call MetaAPI to get deposit address
    // For now, generate a placeholder
    const placeholderAddress = `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    // Cache the address
    await supabase
      .from('broker_deposit_addresses')
      .upsert({
        trading_account_id: accountId,
        user_id: userId,
        broker_name: brokerName,
        currency: 'USDT',
        address: placeholderAddress,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    
    return placeholderAddress;
  }

  // Get user's Bankii wallet deposit address
  private async getBankiiDepositAddress(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('bankii_wallets')
      .select('deposit_address')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data?.deposit_address) {
      return data.deposit_address;
    }
    
    // Generate new address via Bankii API (placeholder for now)
    const newAddress = `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    // Save to database
    await supabase
      .from('bankii_wallets')
      .upsert({
        user_id: userId,
        deposit_address: newAddress,
        currency: 'USDT'
      });
    
    return newAddress;
  }
}

export const transferOrchestrator = new TransferOrchestrator();
