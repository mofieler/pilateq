'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  getPaymentMethodSelectOptions,
  getPaymentMethodLabel,
  getPaymentMethodConfig,
  type PaymentMethod,
} from '@/lib/config/financial-config';

interface PaymentMethodSelectProps {
  value?: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  id?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
  showDescription?: boolean;
  currency?: string;
}

/**
 * Reusable payment method select component with built-in styling and validation
 */
export function PaymentMethodSelect({
  value,
  onChange,
  id = 'payment-method',
  label = 'Payment Method',
  required = false,
  disabled = false,
  placeholder = 'Select a payment method',
  className = '',
  showIcon = false,
  showDescription = false,
  currency,
}: PaymentMethodSelectProps) {
  const options = currency 
    ? getPaymentMethodSelectOptions().filter(option => 
        getPaymentMethodConfig(option.value)?.supportedCurrencies.includes(currency)
      )
    : getPaymentMethodSelectOptions();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as PaymentMethod);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <select
        id={id}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={`
          flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 
          text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          ${!value ? 'text-muted-foreground' : ''}
        `}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {showIcon && getPaymentMethodConfig(option.value)?.icon && 
              `${getPaymentMethodConfig(option.value)?.icon} `
            }
            {option.label}
            {showDescription && option.description && 
              ` - ${option.description}`
            }
          </option>
        ))}
      </select>
    </div>
  );
}

interface PaymentMethodBadgeProps {
  value: PaymentMethod;
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * Display badge for payment methods with consistent styling
 */
export function PaymentMethodBadge({ 
  value, 
  showLabel = true, 
  showIcon = false,
  className = '' 
}: PaymentMethodBadgeProps) {
  const config = getPaymentMethodConfig(value);
  const label = getPaymentMethodLabel(value);

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 ${className}`}>
      {showIcon && config?.icon && (
        <span className="mr-1">{config.icon}</span>
      )}
      {showLabel ? label : ''}
    </span>
  );
}

interface PaymentMethodDisplayProps {
  value: PaymentMethod;
  showDescription?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * Display component for payment method information
 */
export function PaymentMethodDisplay({ 
  value, 
  showDescription = false,
  showIcon = false,
  className = '' 
}: PaymentMethodDisplayProps) {
  const config = getPaymentMethodConfig(value);
  const label = getPaymentMethodLabel(value);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PaymentMethodBadge value={value} showIcon={showIcon} />
      {showDescription && config?.description && (
        <span className="text-sm text-muted-foreground">
          {config.description}
        </span>
      )}
    </div>
  );
}

interface PaymentMethodInfoProps {
  value: PaymentMethod;
  className?: string;
}

/**
 * Detailed information display for payment method
 */
export function PaymentMethodInfo({ value, className = '' }: PaymentMethodInfoProps) {
  const config = getPaymentMethodConfig(value);
  
  if (!config) return null;

  return (
    <div className={`space-y-2 p-3 rounded-lg border border-slate-200 bg-slate-50 ${className}`}>
      <div className="flex items-center gap-2">
        <PaymentMethodBadge value={value} showIcon />
        <h4 className="font-medium text-slate-900">{config.label}</h4>
      </div>
      
      <p className="text-sm text-slate-600">{config.description}</p>
      
      <div className="flex flex-wrap gap-2 text-xs">
        {config.requiresOnlinePayment && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            Online Payment
          </span>
        )}
        {config.requiresManualConfirmation && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
            Manual Confirmation
          </span>
        )}
        {config.processingFeePercent && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            {config.processingFeePercent}% Fee
          </span>
        )}
      </div>
      
      <div className="text-xs text-slate-500">
        Supported currencies: {config.supportedCurrencies.join(', ')}
      </div>
    </div>
  );
}
