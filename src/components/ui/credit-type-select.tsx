'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  getCreditTypeSelectOptions,
  getCreditTypeLabel,
  getCreditTypeBadgeStyle,
  type CreditType,
} from '@/lib/config/class-types';

interface CreditTypeSelectProps {
  value?: CreditType;
  onChange: (value: CreditType) => void;
  id?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Reusable credit type select component with built-in styling and validation
 */
export function CreditTypeSelect({
  value,
  onChange,
  id = 'credit-type',
  label = 'Credit Type',
  required = false,
  disabled = false,
  placeholder = 'Select a credit type',
  className = '',
  showBadge = false,
}: CreditTypeSelectProps) {
  const options = getCreditTypeSelectOptions();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as CreditType);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="relative">
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
              {option.label}
            </option>
          ))}
        </select>
        
        {showBadge && value && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCreditTypeBadgeStyle(value)}`}>
              {getCreditTypeLabel(value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreditTypeBadgeProps {
  value: CreditType;
  showLabel?: boolean;
  className?: string;
}

/**
 * Display badge for credit types with consistent styling
 */
export function CreditTypeBadge({ 
  value, 
  showLabel = true, 
  className = '' 
}: CreditTypeBadgeProps) {
  const style = getCreditTypeBadgeStyle(value);
  const label = getCreditTypeLabel(value);

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}>
      {showLabel ? label : ''}
    </span>
  );
}

interface CreditTypeDisplayProps {
  value: CreditType;
  showDescription?: boolean;
  className?: string;
}

/**
 * Display component for credit type information
 */
export function CreditTypeDisplay({ 
  value, 
  showDescription = false,
  className = '' 
}: CreditTypeDisplayProps) {
  const label = getCreditTypeLabel(value);
  const style = getCreditTypeBadgeStyle(value);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CreditTypeBadge value={value} />
      {showDescription && (
        <span className="text-sm text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
