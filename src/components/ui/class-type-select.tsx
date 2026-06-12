'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  getClassTypeSelectOptions,
  getClassTypeLabel,
  getClassTypeBadgeStyle,
  type ClassType,
} from '@/lib/config/class-types';

interface ClassTypeSelectProps {
  value?: ClassType;
  onChange: (value: ClassType) => void;
  id?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Reusable class type select component with built-in styling and validation
 */
export function ClassTypeSelect({
  value,
  onChange,
  id = 'class-type',
  label = 'Class Type',
  required = false,
  disabled = false,
  placeholder = 'Select a class type',
  className = '',
  showBadge = false,
}: ClassTypeSelectProps) {
  const options = getClassTypeSelectOptions();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as ClassType);
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
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getClassTypeBadgeStyle(value)}`}>
              {getClassTypeLabel(value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ClassTypeBadgeProps {
  value: ClassType;
  showLabel?: boolean;
  className?: string;
}

/**
 * Display badge for class types with consistent styling
 */
export function ClassTypeBadge({ 
  value, 
  showLabel = true, 
  className = '' 
}: ClassTypeBadgeProps) {
  const style = getClassTypeBadgeStyle(value);
  const label = getClassTypeLabel(value);

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}>
      {showLabel ? label : ''}
    </span>
  );
}

interface ClassTypeDisplayProps {
  value: ClassType;
  showDescription?: boolean;
  className?: string;
}

/**
 * Display component for class type information
 */
export function ClassTypeDisplay({ 
  value, 
  showDescription = false,
  className = '' 
}: ClassTypeDisplayProps) {
  const label = getClassTypeLabel(value);
  const style = getClassTypeBadgeStyle(value);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ClassTypeBadge value={value} />
      {showDescription && (
        <span className="text-sm text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
