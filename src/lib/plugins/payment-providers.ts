/**
 * Client-safe payment provider metadata.
 *
 * This file exports ONLY the static metadata that client components need to
 * render payment provider lists. It deliberately does not import any plugin
 * implementations (or the full registry) so it can be bundled for the browser.
 */

export interface PaymentProviderMeta {
  key: string;
  displayName: string;
  description: string;
  type: 'payment';
}

export const PAYMENT_PROVIDERS: readonly PaymentProviderMeta[] = [
  {
    key: 'stripe',
    displayName: 'Stripe',
    description: 'Accept credit and debit card payments securely via Stripe.',
    type: 'payment',
  },
  {
    key: 'pay_at_studio',
    displayName: 'Pay at Studio',
    description: 'Students pay in person at the studio or via bank transfer.',
    type: 'payment',
  },
  {
    key: 'bank_transfer',
    displayName: 'Bank Transfer',
    description: 'Students transfer the amount to the studio bank account.',
    type: 'payment',
  },
  {
    key: 'cash',
    displayName: 'Cash',
    description: 'Students pay with cash at the studio.',
    type: 'payment',
  },
] as const;
