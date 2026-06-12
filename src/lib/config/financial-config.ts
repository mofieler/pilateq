/**
 * CENTRALIZED FINANCIAL CONFIGURATION
 * 
 * This file serves as the single source of truth for all financial configurations
 * including credit packs, payment modalities, and financial types in the application.
 * 
 * Features:
 * - Type-safe definitions for payment methods
 * - Configurable credit pack templates
 * - Easy extension for new payment modalities
 * - Validation helpers for financial operations
 */

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type PaymentMethod = 'stripe' | 'pay_at_studio' | 'bank_transfer' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue' | 'refunded';
// Two-axis package model:
// - 'credit'  → group-class credit packs (reformer or group classes)
// - 'session' → private/duo session packs (reformer only; no mat session packages)
// The equipment type lives on a separate `classType` column.
export type CreditPackCategory = 'credit' | 'session';

export interface PaymentMethodConfig {
  value: PaymentMethod;
  label: string;
  description: string;
  icon?: string;
  requiresOnlinePayment: boolean;
  requiresManualConfirmation: boolean;
  supportedCurrencies: string[];
  processingFeePercent?: number;
  isActive: boolean;
}

export interface FinancialConfig {
  defaultCurrency: string;
  supportedCurrencies: string[];
  taxRatePercent: number;
  refundPolicyDays: number;
  autoRefundEnabled: boolean;
  partialPaymentEnabled: boolean;
  membershipGrantIntervalDays: number;
  membershipDueDateDays: number;
}

// ─── PAYMENT METHODS CONFIGURATION ─────────────────────────────────────────────

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  stripe: {
    value: 'stripe',
    label: 'Credit Card (Stripe)',
    description: 'Pay securely with credit/debit card',
    icon: 'credit-card',
    requiresOnlinePayment: true,
    requiresManualConfirmation: false,
    supportedCurrencies: ['eur', 'usd', 'gbp'],
    processingFeePercent: 2.9,
    isActive: true,
  },
  pay_at_studio: {
    value: 'pay_at_studio',
    label: 'Pay at Studio or Bank Transfer',
    description: 'Pay in person at the studio or via bank transfer',
    icon: 'building',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    isActive: true,
  },
  bank_transfer: {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Transfer funds directly to our bank account',
    icon: 'bank',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    processingFeePercent: 0,
    isActive: true,
  },
  cash: {
    value: 'cash',
    label: 'Cash Payment',
    description: 'Pay with cash at the studio or via bank transfer',
    icon: 'banknote',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    isActive: true,
  },
} as const;

// ─── CREDIT PACK CATEGORIES CONFIGURATION ───────────────────────────────────────

export const CREDIT_PACK_CATEGORIES: Record<CreditPackCategory, {
  value: CreditPackCategory;
  label: string;
  description: string;
  badgeStyle: string;
  defaultValidityDays: number;
}> = {
  credit: {
    value: 'credit',
    label: 'Credit Package',
    description: 'Group class credits — students pick mat or reformer at booking',
    badgeStyle: 'bg-emerald-100 text-emerald-800',
    defaultValidityDays: 365,
  },
  session: {
    value: 'session',
    label: 'Session Package',
    description: 'Private 1:1 and duo reformer sessions',
    badgeStyle: 'bg-amber-100 text-amber-800',
    defaultValidityDays: 365,
  },
} as const;

// ─── FINANCIAL CONFIGURATION ─────────────────────────────────────────────────────

export const FINANCIAL_CONFIG: FinancialConfig = {
  defaultCurrency: 'eur',
  supportedCurrencies: ['eur', 'usd', 'gbp'],
  taxRatePercent: 19,
  refundPolicyDays: 14,
  autoRefundEnabled: true,
  partialPaymentEnabled: true,
  membershipGrantIntervalDays: 7,
  membershipDueDateDays: 14,
};

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Get all payment method values as an array
 */
export function getPaymentMethodValues(): PaymentMethod[] {
  return Object.keys(PAYMENT_METHODS) as PaymentMethod[];
}

/**
 * Get all credit pack category values as an array
 */
export function getCreditPackCategoryValues(): CreditPackCategory[] {
  return Object.keys(CREDIT_PACK_CATEGORIES) as CreditPackCategory[];
}

/**
 * Get payment method configuration by value
 */
export function getPaymentMethodConfig(value: string): PaymentMethodConfig | undefined {
  return PAYMENT_METHODS[value as PaymentMethod];
}

/**
 * Get credit pack category configuration by value
 */
export function getCreditPackCategoryConfig(value: string): typeof CREDIT_PACK_CATEGORIES[CreditPackCategory] | undefined {
  return CREDIT_PACK_CATEGORIES[value as CreditPackCategory];
}

/**
 * Get payment method label for display
 */
export function getPaymentMethodLabel(value: string): string {
  return getPaymentMethodConfig(value)?.label || value;
}

/**
 * Get credit pack category label for display
 */
export function getCreditPackCategoryLabel(value: string): string {
  return getCreditPackCategoryConfig(value)?.label || value;
}

/**
 * Get active payment methods
 */
export function getActivePaymentMethods(): PaymentMethodConfig[] {
  return Object.values(PAYMENT_METHODS).filter(method => method.isActive);
}

/**
 * Get payment methods that support a specific currency
 */
export function getPaymentMethodsForCurrency(currency: string): PaymentMethodConfig[] {
  return Object.values(PAYMENT_METHODS).filter(
    method => method.isActive && method.supportedCurrencies.includes(currency)
  );
}

/**
 * Get select options for payment methods
 */
export function getPaymentMethodSelectOptions(): Array<{ value: PaymentMethod; label: string; description?: string }> {
  return getActivePaymentMethods().map(config => ({
    value: config.value,
    label: config.label,
    description: config.description,
  }));
}

/**
 * Get select options for credit pack categories
 */
export function getCreditPackCategorySelectOptions(): Array<{ value: CreditPackCategory; label: string }> {
  return Object.values(CREDIT_PACK_CATEGORIES).map(config => ({
    value: config.value,
    label: config.label,
  }));
}

/**
 * Validate if a value is a valid payment method
 */
export function isValidPaymentMethod(value: string): value is PaymentMethod {
  return value in PAYMENT_METHODS;
}

/**
 * Validate if a value is a valid credit pack category
 */
export function isValidCreditPackCategory(value: string): value is CreditPackCategory {
  return value in CREDIT_PACK_CATEGORIES;
}

/**
 * Calculate processing fee for a payment method
 */
export function calculateProcessingFee(amountCents: number, paymentMethod: PaymentMethod): number {
  const config = getPaymentMethodConfig(paymentMethod);
  if (!config?.processingFeePercent) return 0;
  return Math.round((amountCents * config.processingFeePercent) / 100);
}

/**
 * Get supported currencies for all active payment methods
 */
export function getSupportedCurrencies(): string[] {
  const currencies = new Set<string>();
  getActivePaymentMethods().forEach(method => {
    method.supportedCurrencies.forEach(currency => currencies.add(currency));
  });
  return Array.from(currencies);
}

// ─── TYPE GUARDS ───────────────────────────────────────────────────────────────

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && isValidPaymentMethod(value);
}

export function isCreditPackCategory(value: unknown): value is CreditPackCategory {
  return typeof value === 'string' && isValidCreditPackCategory(value);
}

