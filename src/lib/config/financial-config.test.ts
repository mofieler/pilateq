/**
 * TESTS FOR FINANCIAL CONFIGURATION
 *
 * These tests ensure the financial configuration system works correctly
 * and maintains type safety throughout the application.
 */

import { describe, it, expect } from 'vitest';
import {
  PAYMENT_METHODS,
  CREDIT_PACK_CATEGORIES,
  FINANCIAL_CONFIG,
  getPaymentMethodValues,
  getCreditPackCategoryValues,
  getPaymentMethodConfig,
  getCreditPackCategoryConfig,
  getPaymentMethodLabel,
  getCreditPackCategoryLabel,
  getActivePaymentMethods,
  getPaymentMethodsForCurrency,
  getPaymentMethodSelectOptions,
  getCreditPackCategorySelectOptions,
  isValidPaymentMethod,
  isValidCreditPackCategory,
  calculateProcessingFee,
  getSupportedCurrencies,
  isPaymentMethod,
  isCreditPackCategory,
  type PaymentMethod,
  type CreditPackCategory,
} from './financial-config';

describe('Financial Configuration', () => {
  describe('Payment Methods', () => {
    it('should have all expected payment methods', () => {
      const expectedMethods: PaymentMethod[] = ['stripe', 'pay_at_studio', 'bank_transfer', 'cash'];
      expect(getPaymentMethodValues()).toEqual(expectedMethods);
    });

    it('should return correct payment method config', () => {
      const stripeConfig = getPaymentMethodConfig('stripe');
      expect(stripeConfig).toEqual({
        value: 'stripe',
        label: 'Credit Card (Stripe)',
        description: 'Pay securely with credit/debit card',
        icon: 'credit-card',
        requiresOnlinePayment: true,
        requiresManualConfirmation: false,
        supportedCurrencies: ['eur', 'usd', 'gbp'],
        processingFeePercent: 2.9,
        isActive: true,
      });
    });

    it('should return undefined for invalid payment method', () => {
      expect(getPaymentMethodConfig('invalid')).toBeUndefined();
    });

    it('should return correct labels for valid payment methods', () => {
      expect(getPaymentMethodLabel('stripe')).toBe('Credit Card (Stripe)');
      expect(getPaymentMethodLabel('pay_at_studio')).toBe('Pay at Studio or Bank Transfer');
    });

    it('should return the value for invalid payment method', () => {
      expect(getPaymentMethodLabel('invalid')).toBe('invalid');
    });

    it('should validate payment methods correctly', () => {
      expect(isValidPaymentMethod('stripe')).toBe(true);
      expect(isValidPaymentMethod('cash')).toBe(true);
      expect(isValidPaymentMethod('invalid')).toBe(false);
    });

    it('should work as type guards', () => {
      const unknownValue: unknown = 'stripe';
      if (isPaymentMethod(unknownValue)) {
        expect(unknownValue satisfies PaymentMethod).toBe('stripe');
      }
    });

    it('should filter active payment methods', () => {
      const activeMethods = getActivePaymentMethods();
      expect(activeMethods).toHaveLength(4);
      expect(activeMethods.every(method => method.isActive)).toBe(true);
    });

    it('should filter payment methods by currency', () => {
      const eurMethods = getPaymentMethodsForCurrency('eur');
      expect(eurMethods).toHaveLength(4);

      const usdMethods = getPaymentMethodsForCurrency('usd');
      expect(usdMethods).toHaveLength(1);
      expect(usdMethods[0].value).toBe('stripe');
    });
  });

  describe('Credit Pack Categories', () => {
    it('should have credit and session categories', () => {
      const expectedCategories: CreditPackCategory[] = ['credit', 'session'];
      expect(getCreditPackCategoryValues()).toEqual(expectedCategories);
    });

    it('should return correct category config for credit', () => {
      const creditConfig = getCreditPackCategoryConfig('credit');
      expect(creditConfig?.value).toBe('credit');
      expect(creditConfig?.label).toBe('Credit Package');
    });

    it('should return correct category config for session', () => {
      const sessionConfig = getCreditPackCategoryConfig('session');
      expect(sessionConfig?.value).toBe('session');
      expect(sessionConfig?.label).toBe('Session Package');
    });

    it('should validate categories correctly', () => {
      expect(isValidCreditPackCategory('credit')).toBe(true);
      expect(isValidCreditPackCategory('session')).toBe(true);
      expect(isValidCreditPackCategory('standard')).toBe(false);
      expect(isValidCreditPackCategory('invalid')).toBe(false);
    });

    it('should work as type guards', () => {
      const unknownValue: unknown = 'session';
      if (isCreditPackCategory(unknownValue)) {
        expect(unknownValue satisfies CreditPackCategory).toBe('session');
      }
    });
  });

  describe('Select Options', () => {
    it('should generate correct payment method select options', () => {
      const options = getPaymentMethodSelectOptions();
      expect(options).toHaveLength(4);
      expect(options[0]).toEqual({
        value: 'stripe',
        label: 'Credit Card (Stripe)',
        description: 'Pay securely with credit/debit card',
      });
    });

    it('should generate correct category select options', () => {
      const options = getCreditPackCategorySelectOptions();
      expect(options).toHaveLength(2);
      expect(options.map(o => o.value)).toEqual(['credit', 'session']);
    });
  });

  describe('Financial Calculations', () => {
    it('should calculate processing fees correctly', () => {
      expect(calculateProcessingFee(10000, 'stripe')).toBe(290); // 2.9% of 10000 cents
      expect(calculateProcessingFee(10000, 'pay_at_studio')).toBe(0); // No fee
      expect(calculateProcessingFee(10000, 'cash')).toBe(0); // No fee
    });

    it('should handle invalid payment method for fee calculation', () => {
      expect(calculateProcessingFee(10000, 'invalid' as PaymentMethod)).toBe(0);
    });
  });

  describe('Supported Currencies', () => {
    it('should return all supported currencies', () => {
      const currencies = getSupportedCurrencies();
      expect(currencies).toContain('eur');
      expect(currencies).toContain('usd');
      expect(currencies).toContain('gbp');
    });
  });

  describe('Financial Config', () => {
    it('should have correct financial configuration', () => {
      expect(FINANCIAL_CONFIG).toEqual({
        defaultCurrency: 'eur',
        supportedCurrencies: ['eur', 'usd', 'gbp'],
        taxRatePercent: 19,
        refundPolicyDays: 14,
        autoRefundEnabled: true,
        partialPaymentEnabled: true,
        membershipDueDateDays: 14,
        membershipGrantIntervalDays: 7,
      });
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required fields in payment method configs', () => {
      Object.values(PAYMENT_METHODS).forEach(config => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('requiresOnlinePayment');
        expect(config).toHaveProperty('requiresManualConfirmation');
        expect(config).toHaveProperty('supportedCurrencies');
        expect(config).toHaveProperty('isActive');
        expect(typeof config.requiresOnlinePayment).toBe('boolean');
        expect(typeof config.requiresManualConfirmation).toBe('boolean');
        expect(Array.isArray(config.supportedCurrencies)).toBe(true);
        expect(typeof config.isActive).toBe('boolean');
      });
    });

    it('should have all required fields in credit pack category configs', () => {
      Object.values(CREDIT_PACK_CATEGORIES).forEach(config => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('badgeStyle');
        expect(config).toHaveProperty('defaultValidityDays');
        expect(typeof config.defaultValidityDays).toBe('number');
      });
    });
  });
});
