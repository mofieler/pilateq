'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  getCreditPackCategorySelectOptions,
  getCreditPackCategoryLabel,
  getCreditPackCategoryConfig,
  type CreditPackCategory,
} from '@/lib/config/financial-config';

interface CreditPackCategorySelectProps {
  value?: CreditPackCategory;
  onChange: (value: CreditPackCategory) => void;
  id?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Reusable credit pack category select component with built-in styling and validation
 */
export function CreditPackCategorySelect({
  value,
  onChange,
  id = 'credit-pack-category',
  label = 'Credit Pack Category',
  required = false,
  disabled = false,
  placeholder = 'Select a category',
  className = '',
  showBadge = false,
}: CreditPackCategorySelectProps) {
  const options = getCreditPackCategorySelectOptions();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as CreditPackCategory);
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
            <CreditPackCategoryBadge value={value} />
          </div>
        )}
      </div>
    </div>
  );
}

interface CreditPackCategoryBadgeProps {
  value: CreditPackCategory;
  showLabel?: boolean;
  className?: string;
}

/**
 * Display badge for credit pack categories with consistent styling
 */
export function CreditPackCategoryBadge({ 
  value, 
  showLabel = true, 
  className = '' 
}: CreditPackCategoryBadgeProps) {
  const config = getCreditPackCategoryConfig(value);
  const label = getCreditPackCategoryLabel(value);

  if (!config) return null;

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeStyle} ${className}`}>
      {showLabel ? label : ''}
    </span>
  );
}

interface CreditPackCategoryDisplayProps {
  value: CreditPackCategory;
  showDescription?: boolean;
  className?: string;
}

/**
 * Display component for credit pack category information
 */
export function CreditPackCategoryDisplay({ 
  value, 
  showDescription = false,
  className = '' 
}: CreditPackCategoryDisplayProps) {
  const config = getCreditPackCategoryConfig(value);
  const label = getCreditPackCategoryLabel(value);

  if (!config) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CreditPackCategoryBadge value={value} />
      {showDescription && (
        <span className="text-sm text-muted-foreground">
          {config.description}
        </span>
      )}
    </div>
  );
}

interface CreditPackCategoryInfoProps {
  value: CreditPackCategory;
  className?: string;
}

/**
 * Detailed information display for credit pack category
 */
export function CreditPackCategoryInfo({ value, className = '' }: CreditPackCategoryInfoProps) {
  const config = getCreditPackCategoryConfig(value);
  
  if (!config) return null;

  return (
    <div className={`space-y-2 p-3 rounded-lg border border-slate-200 bg-slate-50 ${className}`}>
      <div className="flex items-center gap-2">
        <CreditPackCategoryBadge value={value} />
        <h4 className="font-medium text-slate-900">{config.label}</h4>
      </div>
      
      <p className="text-sm text-slate-600">{config.description}</p>
      
      <div className="text-xs text-slate-500">
        Default validity: {config.defaultValidityDays} days
      </div>
    </div>
  );
}
