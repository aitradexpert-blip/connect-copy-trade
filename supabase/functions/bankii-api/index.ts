// Supabase Edge Function: bankii-api
// Purpose: Interface with Bankii wallet API for crypto operations

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Bankii API configuration (placeholder - replace with actual Bankii API endpoints)
const BANKII_API_URL = Deno.env.get('BANKII_API_URL') || 'https://api.bankii.io/v1'
const BANKII_API_KEY = Deno.env.get('BANKII_API_KEY') || ''

interface BankiiResponse {
  success: boolean
  data?: any
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    const { action, ...params } = await req.json()

    console.log(`[Bankii] Action: ${action}, User: ${user.id}`)

    let result: BankiiResponse

    switch (action) {
      case 'generate-address':
        result = await generateDepositAddress(supabase, user.id, params.currency || 'USDT')
        break

      case 'get-balance':
        result = await getWalletBalance(supabase, user.id)
        break

      case 'send':
        result = await sendCrypto(supabase, user.id, params)
        break

      case 'get-transactions':
        result = await getTransactions(supabase, user.id, params.limit || 20)
        break

      default:
        result = { success: false, error: 'Unknown action' }
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('[Bankii] Error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

// Generate a unique deposit address for the user
async function generateDepositAddress(supabase: any, userId: string, currency: string): Promise<BankiiResponse> {
  try {
    // Check if user already has an address
    const { data: existing } = await supabase
      .from('bankii_wallets')
      .select('deposit_address')
      .eq('user_id', userId)
      .eq('currency', currency)
      .maybeSingle()

    if (existing?.deposit_address) {
      return {
        success: true,
        data: { address: existing.deposit_address, currency }
      }
    }

    // In production, call Bankii API to generate new address
    // For now, generate a placeholder address
    const newAddress = `0x${Array.from({length: 40}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`

    // If Bankii API key is configured, make actual API call
    if (BANKII_API_KEY) {
      try {
        const response = await fetch(`${BANKII_API_URL}/wallets/address`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${BANKII_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId, currency })
        })

        if (response.ok) {
          const apiData = await response.json()
          if (apiData.address) {
            // Save to database
            await supabase
              .from('bankii_wallets')
              .upsert({
                user_id: userId,
                deposit_address: apiData.address,
                currency,
                last_synced_at: new Date().toISOString()
              })

            return {
              success: true,
              data: { address: apiData.address, currency }
            }
          }
        }
      } catch (apiError) {
        console.error('[Bankii] API error:', apiError)
        // Fall back to placeholder
      }
    }

    // Save placeholder address
    await supabase
      .from('bankii_wallets')
      .upsert({
        user_id: userId,
        deposit_address: newAddress,
        currency,
        last_synced_at: new Date().toISOString()
      })

    return {
      success: true,
      data: { address: newAddress, currency, isPlaceholder: true }
    }

  } catch (error) {
    console.error('[Bankii] Generate address error:', error)
    return { success: false, error: error.message }
  }
}

// Get user's wallet balance (cached)
async function getWalletBalance(supabase: any, userId: string): Promise<BankiiResponse> {
  try {
    const { data, error } = await supabase
      .from('bankii_wallets')
      .select('currency, balance, last_synced_at')
      .eq('user_id', userId)

    if (error) throw error

    // Check if we need to refresh from Bankii API (older than 5 minutes)
    const needsRefresh = !data || data.length === 0 || 
      data.some((w: any) => {
        const lastSync = new Date(w.last_synced_at)
        return (Date.now() - lastSync.getTime()) > 5 * 60 * 1000
      })

    if (needsRefresh && BANKII_API_KEY) {
      try {
        const response = await fetch(`${BANKII_API_URL}/wallets/${userId}/balance`, {
          headers: { 'Authorization': `Bearer ${BANKII_API_KEY}` }
        })

        if (response.ok) {
          const apiData = await response.json()
          // Update cached balances
          for (const wallet of apiData.wallets || []) {
            await supabase
              .from('bankii_wallets')
              .upsert({
                user_id: userId,
                currency: wallet.currency,
                balance: wallet.balance,
                last_synced_at: new Date().toISOString()
              })
          }
          return { success: true, data: apiData }
        }
      } catch (apiError) {
        console.error('[Bankii] Balance API error:', apiError)
      }
    }

    return {
      success: true,
      data: {
        wallets: data || [],
        lastUpdated: data?.[0]?.last_synced_at
      }
    }

  } catch (error) {
    console.error('[Bankii] Get balance error:', error)
    return { success: false, error: error.message }
  }
}

// Send crypto from wallet to external address
async function sendCrypto(supabase: any, userId: string, params: {
  toAddress: string
  amount: number
  currency: string
}): Promise<BankiiResponse> {
  try {
    const { toAddress, amount, currency } = params

    if (!toAddress || !amount || amount <= 0) {
      return { success: false, error: 'Invalid parameters' }
    }

    // Check balance
    const { data: wallet } = await supabase
      .from('bankii_wallets')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency', currency)
      .maybeSingle()

    if (!wallet || wallet.balance < amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    // In production, call Bankii API to initiate transfer
    if (BANKII_API_KEY) {
      try {
        const response = await fetch(`${BANKII_API_URL}/wallets/${userId}/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${BANKII_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ toAddress, amount, currency })
        })

        if (response.ok) {
          const apiData = await response.json()
          
          // Update local balance
          await supabase
            .from('bankii_wallets')
            .update({ 
              balance: wallet.balance - amount,
              last_synced_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('currency', currency)

          return {
            success: true,
            data: {
              transactionId: apiData.transactionId,
              status: 'processing',
              amount,
              currency,
              toAddress
            }
          }
        } else {
          const errorData = await response.json()
          return { success: false, error: errorData.message || 'Transfer failed' }
        }
      } catch (apiError) {
        console.error('[Bankii] Send API error:', apiError)
        return { success: false, error: 'Failed to connect to Bankii' }
      }
    }

    // Placeholder: Deduct from local balance
    await supabase
      .from('bankii_wallets')
      .update({ 
        balance: wallet.balance - amount,
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('currency', currency)

    return {
      success: true,
      data: {
        transactionId: `sim_${Date.now()}`,
        status: 'processing',
        amount,
        currency,
        toAddress,
        isSimulated: true
      }
    }

  } catch (error) {
    console.error('[Bankii] Send error:', error)
    return { success: false, error: error.message }
  }
}

// Get user's transaction history
async function getTransactions(supabase: any, userId: string, limit: number): Promise<BankiiResponse> {
  try {
    const { data, error } = await supabase
      .from('fund_transfers')
      .select('*')
      .eq('user_id', userId)
      .or('source_type.eq.bankii_wallet,dest_type.eq.bankii_wallet')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: { transactions: data || [] }
    }

  } catch (error) {
    console.error('[Bankii] Get transactions error:', error)
    return { success: false, error: error.message }
  }
}
