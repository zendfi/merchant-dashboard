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

// Password login returns a different structure than passkey login
export interface PasswordLoginResponse {
  success: boolean;
  session_token: string;
  merchant_id: string;
  email: string;
  name: string;
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

export interface ApiUsageTimelineEntry {
  time: string;
  total: number;
  successful: number;
  failed: number;
}

export interface Transaction {
  id: string;
  amount_usd: number;
  token: string;
  status: string;
  customer_wallet: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  metadata: Record<string, unknown> | null;
  has_splits: boolean;
  created_at: string;
  mode?: string;
  split_count?: number;
  payment_token?: string;
  reconciled: boolean;
  reconciled_at: string | null;
  internal_notes: string | null;
  transaction_signature: string | null;
  // Payment recovery fields
  flagged_for_review: boolean;
  flagged_at: string | null;
  flag_reason: string | null;
  is_onramp: boolean;
  paj_order_id: string | null;
  paj_external_order_id: string | null;
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
  chart_data: Array<{
    date: string;
    successful: number;
    failed: number;
  }>;
}

export interface PaymentLink {
  id: string;
  link_code: string;
  payment_url: string;
  hosted_page_url: string;
  amount: number;
  currency: string;
  token: string;
  description?: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  onramp: boolean;
}

export interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  token?: string;
  description?: string;
  max_uses?: number;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  onramp?: boolean;
  /** Original NGN amount for exact PAJ conversion (if created via NGN calculator) */
  amount_ngn?: number;
  /**
   * If true, a service charge (max(₦30, ceil(3% of amount_ngn))) is added on top
   * and charged to the payer. The payer sees the breakdown on checkout.
   * If false/absent, the merchant absorbs any PAJ slippage.
   */
  payer_service_charge?: boolean;
  /** If true, checkout shows an expanded form collecting name, phone, company & billing address */
  collect_customer_info?: boolean;
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
  loginPassword: async (email: string, password: string): Promise<PasswordLoginResponse> => {
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
    // Add cache-busting parameter to ensure fresh data
    const timestamp = Date.now();
    return apiCall(`/api/v1/merchants/me?_t=${timestamp}`);
  },

  // Get dashboard stats
  getStats: async (mode: 'test' | 'live'): Promise<DashboardStats> => {
    return apiCall(`/api/v1/merchants/me/stats?mode=${mode}`);
  },

  // Get dashboard analytics
  getAnalytics: async (): Promise<DashboardAnalytics> => {
    return apiCall('/api/v1/merchants/me/analytics');
  },
};

// Session Key type
export interface SessionKey {
  id: string;
  limit_usdc: number;
  used_amount_usdc: number;
  remaining_usdc: number;
  expires_at: string;
  is_active: boolean;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  session_wallet: string | null;
  agent_id: string | null;
  agent_name: string | null;
  user_wallet: string | null;
}

export interface SessionKeyStats {
  total: number;
  active: number;
  total_limit_usdc: number;
  total_used_usdc: number;
  total_remaining_usdc: number;
}

// Session Keys APIs
export const sessionKeys = {
  // List all session keys
  list: async (): Promise<{ session_keys: SessionKey[]; stats: SessionKeyStats }> => {
    return apiCall('/api/v1/merchants/me/session-keys');
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

  // Get API usage timeline
  getUsageTimeline: async (hours: number = 168): Promise<{ timeline: ApiUsageTimelineEntry[] }> => {
    return apiCall(`/api/v1/merchants/me/api-keys/usage?hours=${hours}`);
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
      reconciled?: boolean;
      start_date?: string;
      end_date?: string;
      sort_by?: 'amount' | 'status' | 'created_at';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number; showing: number }> => {
    const searchParams = new URLSearchParams();
    if (params.mode) searchParams.set('mode', params.mode);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.reconciled !== undefined) searchParams.set('reconciled', params.reconciled.toString());
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);

    return apiCall(`/api/v1/merchants/me/transactions?${searchParams.toString()}`);
  },

  // Update transaction reconciliation
  update: async (
    transactionId: string,
    data: {
      reconciled?: boolean;
      internal_notes?: string;
    }
  ): Promise<{
    id: string;
    reconciled: boolean;
    reconciled_at: string | null;
    internal_notes: string | null;
  }> => {
    return apiCall(`/api/v1/merchants/me/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Flag a payment for admin review
  flagForReview: async (
    transactionId: string,
    reason?: string
  ): Promise<{ success: boolean; payment_id: string; message: string }> => {
    return apiCall(`/api/v1/merchants/me/transactions/${transactionId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? null }),
    });
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
    },
    mode: 'test' | 'live' = 'live'
  ): Promise<{ success: boolean; explorer_url: string }> => {
    return apiCall('/api/v1/merchants/me/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        to_address: toAddress,
        amount,
        token,
        passkey_signature: passkeySignature,
        mode,
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

// Offramp (Bank Withdrawal) Types
export interface OfframpRates {
  rates: {
    onRampRate: {
      id: string;
      baseCurrency: string;
      targetCurrency: string;
      rate: number;
      createdAt: string;
      type: string;
    };
    offRampRate: {
      id: string;
      baseCurrency: string;
      targetCurrency: string;
      rate: number;
      createdAt: string;
      type: string;
    };
  };
  usdc_balance: number;
}

export interface PajBank {
  id: string;
  name: string;
  code: string;
  country: string;
}

export interface BankAccountDetails {
  accountName: string;
  accountNumber: string;
  bank: PajBank;
}

export interface OfframpOrder {
  order_id: string;
  paj_order_id: string;
  paj_deposit_address: string;
  amount_usdc: number;
  fiat_amount: number;
  currency: string;
  exchange_rate: number;
  fee: number;
  status: string;
  bank_account_number: string;
  bank_name?: string;
}

// Offramp (Withdraw to Bank) APIs
export const offramp = {
  // Get offramp rates and USDC balance
  getRates: async (): Promise<OfframpRates> => {
    return apiCall('/api/v1/offramp/rates');
  },

  // Initiate offramp session (send OTP)
  initiate: async (email: string): Promise<{ session_initiated: boolean; message: string }> => {
    return apiCall('/api/v1/offramp/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Verify OTP and get session token
  verifyOtp: async (email: string, otp: string): Promise<{ session_token: string; verified: boolean }> => {
    return apiCall('/api/v1/offramp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  // Get available banks
  getBanks: async (sessionToken: string): Promise<{ banks: PajBank[] }> => {
    return apiCall('/api/v1/offramp/banks', {
      method: 'POST',
      body: JSON.stringify({ session_token: sessionToken }),
    });
  },

  // Resolve bank account details
  resolveAccount: async (
    sessionToken: string,
    bankId: string,
    accountNumber: string
  ): Promise<BankAccountDetails> => {
    return apiCall('/api/v1/offramp/resolve-account', {
      method: 'POST',
      body: JSON.stringify({
        session_token: sessionToken,
        bank_id: bankId,
        account_number: accountNumber,
      }),
    });
  },

  // Create offramp order
  createOrder: async (
    sessionToken: string,
    amountUsdc: number,
    bankId: string,
    accountNumber: string
  ): Promise<OfframpOrder> => {
    return apiCall('/api/v1/offramp/create-order', {
      method: 'POST',
      body: JSON.stringify({
        session_token: sessionToken,
        amount_usdc: amountUsdc,
        bank_id: bankId,
        account_number: accountNumber,
      }),
    });
  },

  // Execute transfer (send USDC to PAJ)
  executeTransfer: async (
    orderId: string,
    passkeySignature: {
      credential_id: string;
      authenticator_data: number[];
      signature: number[];
      client_data_json: number[];
    }
  ): Promise<{ success: boolean; tx_signature: string; explorer_url: string; message: string }> => {
    return apiCall('/api/v1/offramp/execute-transfer', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        passkey_signature: passkeySignature,
      }),
    });
  },

  // Get order status
  getOrder: async (orderId: string): Promise<OfframpOrder> => {
    return apiCall(`/api/v1/offramp/orders/${orderId}`);
  },
};

// Support APIs
export const support = {
  // Send support message
  sendMessage: async (message: string): Promise<{ success: boolean; message: string }> => {
    return apiCall('/api/v1/merchants/me/support', {
      method: 'POST',
      body: JSON.stringify({ message }),
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

// Payment Links APIs (requires API key)
export const paymentLinks = {
  // Create a payment link
  create: async (
    apiKey: string,
    data: CreatePaymentLinkRequest
  ): Promise<PaymentLink> => {
    const response = await fetch(`${API_BASE}/api/v1/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to create payment link');
    }

    return response.json();
  },

  // List payment links
  list: async (apiKey: string): Promise<PaymentLink[]> => {
    const response = await fetch(`${API_BASE}/api/v1/payment-links`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to list payment links');
    }

    return response.json();
  },
};

// Customer APIs
export interface Customer {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  total_payments: number;
  confirmed_payments: number;
  pending_payments: number;
  failed_payments: number;
  total_spent: number;
  avg_order_value: number;
  first_seen: string;
  last_seen: string;
  has_onramp: boolean;
  billing_country: string | null;
  billing_city: string | null;
  churn_risk: boolean;
  customer_type: 'new' | 'returning' | 'no_payment';
}

export interface CustomerChartPoint {
  date: string;
  count: number;
  volume: number;
}

export interface CustomerPayment {
  id: string;
  amount_usd: number;
  status: string;
  payment_token: string | null;
  transaction_signature: string | null;
  created_at: string;
  is_onramp: boolean;
  custom_fields: Record<string, unknown> | null;
}

export interface CustomerDetail {
  profile: {
    email: string;
    name: string | null;
    phone: string | null;
    company: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
    billing_country: string | null;
    shipping_address_line1: string | null;
    shipping_address_line2: string | null;
    shipping_city: string | null;
    shipping_state: string | null;
    shipping_postal_code: string | null;
    shipping_country: string | null;
    custom_fields: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    first_seen: string;
  };
  payments: CustomerPayment[];
  chart: CustomerChartPoint[];
}

export const customers = {
  list: async (params: {
    mode?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> => {
    const query = new URLSearchParams();
    if (params.mode) query.set('mode', params.mode);
    if (params.search) query.set('search', params.search);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.page) query.set('page', String(params.page));
    return apiCall(`/api/v1/merchants/me/customers?${query.toString()}`);
  },

  getDetail: async (email: string, mode = 'live'): Promise<CustomerDetail> => {
    return apiCall(`/api/v1/merchants/me/customers/${encodeURIComponent(email)}?mode=${mode}`);
  },
};

export default {
  auth,
  merchant,
  apiKeys,
  transactions,
  webhooks,
  wallet,
  support,
  webauthn,
  paymentLinks,
  customers,
};
