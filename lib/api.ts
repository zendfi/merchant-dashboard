// API Client for ZendFi Merchant Dashboard
// This module handles all API calls to the backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Types
export interface MerchantProfile {
  id: string;
  name: string;
  email: string;
  wallet_address: string;
  wallet_type: string | null;
  has_passkey: boolean;
  created_at: string;
  webhook_url?: string | null;
}

export interface MerchantAuthResponse {
  success: boolean;
  merchant: MerchantProfile;
  expires_at: number;
}

export interface LoginChallengeResponse {
  session_id: string;
  challenge: string;
  webauthn_options: {
    publicKey?: {
      challenge: string;
      allowCredentials: Array<{
        id: string;
        type: string;
        transports?: string[];
      }>;
      timeout?: number;
      rpId?: string;
      userVerification?: string;
    };
  };
}

export interface ApiKey {
  id: string;
  prefix: string;
  mode: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface Transaction {
  id: string;
  amount_usd: number;
  token: string;
  status: string;
  customer_wallet: string | null;
  metadata: Record<string, unknown> | null;
  has_splits: boolean;
  created_at: string;
  mode?: string;
  split_count?: number;
  payment_token?: string;
}

export interface DashboardStats {
  total_payments: number;
  total_volume: number;
  confirmed_payments: number;
  pending_payments: number;
}

export interface WalletInfo {
  wallet_address: string;
  sol_balance: number;
  usdc_balance: number;
  has_mpc_wallet: boolean;
}

export interface WebhookStats {
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  pending_deliveries: number;
  success_rate: string;
  last_delivery_at: string | null;
  avg_attempts: number | null;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface DashboardAnalytics {
  payments_chart: ChartDataPoint[];
  volume_chart: ChartDataPoint[];
  api_calls_chart: ChartDataPoint[];
  success_rate_chart: ChartDataPoint[];
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

// Authentication APIs
export const auth = {
  // Start passkey login flow
  loginStart: async (email: string): Promise<LoginChallengeResponse> => {
    return apiCall('/api/v1/merchants/login/start', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Verify passkey login
  loginVerify: async (
    sessionId: string,
    credentialResponse: unknown
  ): Promise<MerchantAuthResponse> => {
    return apiCall('/api/v1/merchants/login/verify', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        credential_response: credentialResponse,
      }),
    });
  },

  // Password login
  loginPassword: async (email: string, password: string): Promise<MerchantAuthResponse> => {
    return apiCall('/api/v1/merchants/login/password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Logout
  logout: async (): Promise<{ success: boolean; message: string }> => {
    return apiCall('/api/v1/merchants/logout', { method: 'POST' });
  },

  // Request password reset
  requestReset: async (
    email: string,
    resetType: 'password' | 'passkey'
  ): Promise<{ success: boolean }> => {
    return apiCall('/api/v1/merchants/password/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email, reset_type: resetType }),
    });
  },

  // Verify reset token
  verifyResetToken: async (
    token: string
  ): Promise<{ valid: boolean; email?: string; token_type?: string; merchant_id?: string }> => {
    return apiCall('/api/v1/merchants/password/reset/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  // Reset password
  resetPassword: async (
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean }> => {
    return apiCall('/api/v1/merchants/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
  },
};

// Merchant APIs
export const merchant = {
  // Get current merchant profile
  getProfile: async (): Promise<MerchantProfile> => {
    return apiCall('/api/v1/merchants/me');
  },

  // Get dashboard stats
  getStats: async (mode: 'test' | 'live'): Promise<DashboardStats> => {
    return apiCall(`/api/v1/merchants/me/stats?mode=${mode}`);
  },

  // Get dashboard analytics
  getAnalytics: async (): Promise<DashboardAnalytics> => {
    return apiCall('/dashboard/analytics');
  },
};

// API Keys APIs
export const apiKeys = {
  // List all API keys
  list: async (): Promise<{ api_keys: ApiKey[]; total: number }> => {
    return apiCall('/api/v1/merchants/me/api-keys');
  },

  // Regenerate API key
  regenerate: async (keyId: string): Promise<{ api_key: string; key_id: string }> => {
    return apiCall(`/api/v1/merchants/me/api-keys/${keyId}/regenerate`, {
      method: 'POST',
    });
  },
};

// Transactions APIs
export const transactions = {
  // List transactions
  list: async (
    params: {
      mode?: 'test' | 'live';
      limit?: number;
      page?: number;
      status?: string;
      search?: string;
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number; showing: number }> => {
    const searchParams = new URLSearchParams();
    if (params.mode) searchParams.set('mode', params.mode);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);

    return apiCall(`/api/v1/merchants/me/transactions?${searchParams.toString()}`);
  },
};

// Webhook APIs
export const webhooks = {
  // Get webhook stats
  getStats: async (): Promise<WebhookStats> => {
    return apiCall('/api/v1/merchants/me/webhook/stats');
  },

  // Update webhook URL
  update: async (webhookUrl: string | null): Promise<{ message: string; webhook_url: string | null }> => {
    return apiCall('/api/v1/merchants/me/webhook', {
      method: 'PUT',
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
  },

  // Test webhook
  test: async (): Promise<{
    success: boolean;
    status_code?: number;
    response_time_ms?: number;
    response_body?: string;
    message?: string;
    error?: string;
  }> => {
    return apiCall('/api/v1/merchants/me/webhook/test', { method: 'POST' });
  },
};

// Wallet APIs
export const wallet = {
  // Get wallet info
  getInfo: async (mode: 'test' | 'live'): Promise<WalletInfo> => {
    return apiCall(`/api/v1/merchants/me/wallet?mode=${mode}`);
  },

  // Withdraw tokens
  withdraw: async (
    toAddress: string,
    amount: number,
    token: 'Sol' | 'Usdc',
    passkeySignature: {
      credential_id: string;
      authenticator_data: number[];
      signature: number[];
      client_data_json: number[];
    }
  ): Promise<{ success: boolean; explorer_url: string }> => {
    return apiCall('/api/v1/merchants/me/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        to_address: toAddress,
        amount,
        token,
        passkey_signature: passkeySignature,
      }),
    });
  },

  // Export private key
  exportPrivateKey: async (passkeySignature: {
    credential_id: string;
    authenticator_data: number[];
    signature: number[];
    client_data_json: number[];
  }): Promise<{ private_key_base58: string }> => {
    return apiCall('/api/v1/merchants/me/wallet/export', {
      method: 'POST',
      body: JSON.stringify({ passkey_signature: passkeySignature }),
    });
  },
};

// WebAuthn APIs
export const webauthn = {
  // Start passkey registration
  registerStart: async (data: {
    merchant_id: string;
    email: string;
    display_name: string;
    is_reset?: boolean;
  }): Promise<{ challenge_id: string; options: unknown }> => {
    return apiCall('/api/v1/webauthn/register/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Finish passkey registration
  registerFinish: async (data: {
    challenge_id: string;
    credential: unknown;
  }): Promise<{ success: boolean }> => {
    return apiCall('/api/v1/webauthn/register/finish', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default {
  auth,
  merchant,
  apiKeys,
  transactions,
  webhooks,
  wallet,
  webauthn,
};
