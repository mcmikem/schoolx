export type PaymentProvider = 'mtn_momo' | 'airtel_money' | 'schoolpay';

export interface PaymentRequest {
  provider: PaymentProvider;
  phone: string;
  amount: number;
  reference: string;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  checkout_url?: string;
}

export interface PaymentConfig {
  provider: PaymentProvider;
  name: string;
  icon: string;
  color: string;
  minAmount: number;
  maxAmount: number;
  supportedCurrencies: string[];
}

export const PAYMENT_PROVIDERS: Record<PaymentProvider, PaymentConfig> = {
  mtn_momo: {
    provider: 'mtn_momo',
    name: 'MTN MoMo',
    icon: 'smartphone',
    color: '#FFB400',
    minAmount: 100,
    maxAmount: 5000000,
    supportedCurrencies: ['UGX'],
  },
  airtel_money: {
    provider: 'airtel_money',
    name: 'Airtel Money',
    icon: 'account_balance_wallet',
    color: '#E8112D',
    minAmount: 100,
    maxAmount: 3000000,
    supportedCurrencies: ['UGX'],
  },
  schoolpay: {
    provider: 'schoolpay',
    name: 'SchoolPay',
    icon: 'school',
    color: '#0066CC',
    minAmount: 100,
    maxAmount: 10000000,
    supportedCurrencies: ['UGX'],
  },
};

export function isValidPaymentAmount(
  provider: PaymentProvider,
  amount: number
): boolean {
  const config = PAYMENT_PROVIDERS[provider];
  return amount >= config.minAmount && amount <= config.maxAmount;
}