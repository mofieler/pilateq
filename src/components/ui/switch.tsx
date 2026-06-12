'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Default checked state for uncontrolled usage. */
  defaultChecked?: boolean;
  /** Called when the switch is toggled. */
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onClick, ...props }, ref) => {
    return (
      <label
        className={cn(
          'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
          'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
          'has-[:checked]:bg-[#4e2b22] has-[:not(:checked)]:bg-[#ede8e5]',
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          className="peer sr-only"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
            'translate-x-0.5 peer-checked:translate-x-[1.375rem]'
          )}
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
