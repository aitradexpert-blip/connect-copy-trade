const METAAPI_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI0YjZjNzJlNGFkMmQyN2M1ZjRkNTU1MmMwNjUxYTMwYiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNGI2YzcyZTRhZDJkMjdjNWY0ZDU1NTJjMDY1MWEzMGIiLCJpYXQiOjE3NTY0NTg4OTYsImV4cCI6MTc2NDIzNDg5Nn0.OLTaUHfJOiJ871IOCI5I7l2HJRVuF52TT-ORPSjNMZVmx4YyCTn0Y7LaOrcJa1Z5xJGhV_1ArIG1uR702iegWVwNV6tdWxkDT0i__qiAZSPRuMLFxUl6a5nyJn5mWiSJQnYw21UGy1m0JnzKApP_kGEn1cBEdJTvOwZe4bGXL3cRcD1JJ208K_mQT-37sV1PDBWbfsoF46lN9fWrGWtDyi7vmim8kbdn2O4CKhYd06uixSilyA3kBHSAaSmrmAJycFNiR2-Rd_zag0vty3mAHarA0lIoevdS1fYJSDZWF1hbsB3DS1qE1FHpaWgLupzr_78cX1X6wepwaJhmiF7t9KvlhUWxDFXjHtXPxAieAd8-dg5cvgv_eQtiqaHj2EcG8Y47Ekz4EHuQOyHrBwWRtsX-xKUvx8cIE6zsNCvBfvylgclIvBytan8GWpphre1GoLkZG9wG75MCcKFYyq3AceOdY1Ih5z9HfwrzOQMOMz6Jxy4VYr_KCugh7DPYtnkfSr3RsofnWsD9NaD9gA1s7c_kAl8Z2Q1hGBoeUQihFZjC1nh_BS0SSGqMcJsyBnghzZ_47b5NLm5BhYz_RYDtCl-qeKca4LLdFdVM245H9IgWpRMZGvvZMlTt_ZqhPNRDbGLPFQPjcs8F1bvaJHsEpYic-rC1vzDVUCh14c3AtuE";

const PROVISIONING_API_URL = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const CLIENT_API_URL = "https://mt-client-api-v1.london.agiliumtrade.ai";

export interface MetaApiAccount {
  _id: string;
  login: string;
  name: string;
  server: string;
  platform: string;
  connectionStatus: string;
  state: string;
  type: string;
  baseCurrency: string;
  balance?: number;
  equity?: number;
}

export interface CreateAccountRequest {
  login: string;
  password: string;
  name: string;
  server: string;
  platform: 'mt4' | 'mt5';
  magic: number;
}

export interface TradeRequest {
  actionType: string;
  symbol: string;
  volume: number;
  takeProfit?: number;
  stopLoss?: number;
  openPrice?: number;
}

class MetaApiService {
  private generateTransactionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async getAccounts(): Promise<MetaApiAccount[]> {
    try {
      const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts`, {
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching MetaAPI accounts:', error);
      throw error;
    }
  }

  async createAccount(accountData: CreateAccountRequest): Promise<{ id: string; state: string }> {
    try {
      const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts`, {
        method: 'POST',
        headers: {
          'auth-token': METAAPI_TOKEN,
          'transaction-id': this.generateTransactionId(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create account: ${response.statusText} - ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating MetaAPI account:', error);
      throw error;
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete account: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting MetaAPI account:', error);
      throw error;
    }
  }

  async executeTrade(accountId: string, trade: TradeRequest): Promise<any> {
    try {
      const response = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/trade`, {
        method: 'POST',
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(trade),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to execute trade: ${response.statusText} - ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing trade:', error);
      throw error;
    }
  }

  async getAccountInformation(accountId: string): Promise<any> {
    try {
      const response = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/account-information`, {
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch account information: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching account information:', error);
      throw error;
    }
  }

  async getPositions(accountId: string): Promise<any[]> {
    try {
      const response = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/positions`, {
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }
}

export const metaApiService = new MetaApiService();