/**
 * Plugin type contracts.
 *
 * This file defines the interfaces that every plugin must implement.
 * Adding a new payment provider, access model, or class pass partner means
 * creating one file that satisfies one of these interfaces and registering
 * it in registry.ts.
 */

import type { StudioConfig } from '@/lib/studio';

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface PluginContext {
  studioConfig: StudioConfig;
  studioId: string;
  userId?: string;
  /** Database transaction, when the caller is already inside one. */
  tx?: unknown;
}

export interface BasePlugin {
  /** Unique machine-readable key. Must match values in StudioConfig enums. */
  key: string;
  /** Human-readable label shown in onboarding and settings. */
  displayName: string;
  /** Short description for the UI. */
  description: string;
  /** Whether this plugin is available globally (some may be region-locked). */
  availableGlobally: boolean;
  /** Optional list of supported country codes (ISO 3166-1 alpha-2). */
  supportedCountries?: string[];
}

// ---------------------------------------------------------------------------
// Payment providers
// ---------------------------------------------------------------------------

export interface PaymentIntent {
  id: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  /** For hosted checkout flows (Stripe, PayPal) the URL the user must be redirected to. */
  redirectUrl?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface CreatePaymentInput {
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
}

export interface PaymentProviderPlugin extends BasePlugin {
  type: 'payment';
  /** Returns true if the provider can be used with the given studio config. */
  isAvailable(config: StudioConfig): boolean;
  /** Initiates a payment and returns a provider-specific intent/redirect. */
  createPayment(ctx: PluginContext, input: CreatePaymentInput): Promise<PaymentIntent>;
  /** Refunds a payment (full or partial). */
  refund?(ctx: PluginContext, paymentId: string, amountCents?: number): Promise<PaymentIntent>;
  /** Handles provider webhooks. Returns the normalized intent or null if ignored. */
  handleWebhook?(ctx: PluginContext, request: Request): Promise<PaymentIntent | null>;
}

// ---------------------------------------------------------------------------
// Access providers (credits, memberships, class passes, drop-in, free)
// ---------------------------------------------------------------------------

export interface AccessGrant {
  /** Unique ID for this grant instance (credit lot id, membership id, check-in id, etc.). */
  grantId: string;
  /** Provider key that issued the grant. */
  provider: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Number of entitlements consumed (usually 1 for a class). */
  quantityConsumed: number;
  /** Provider-specific metadata to support refunds/cancellation. */
  metadata?: Record<string, unknown>;
}

export interface AccessRequirement {
  classType: string;
  sessionId?: string;
  sessionType?: 'group' | 'private' | 'duo';
  creditType?: string;
  sessionSubtype?: 'private' | 'duo';
  cost: number;
}

export interface AccessProviderPlugin extends BasePlugin {
  type: 'access';
  /** Returns true if the provider is enabled for this studio. */
  isEnabled(config: StudioConfig): boolean;
  /**
   * Attempts to grant access for the requested class.
   * Returns an AccessGrant if successful, or null if this provider cannot cover it.
   * Implementations should be idempotent and safe to retry.
   */
  grantAccess(ctx: PluginContext, requirement: AccessRequirement): Promise<AccessGrant | null>;
  /**
   * Releases a previously granted access (cancellation/refund).
   */
  releaseAccess(ctx: PluginContext, grant: AccessGrant): Promise<void>;
  /**
   * Returns a preview of available entitlements for UI display (optional).
   */
  previewEntitlements?(ctx: PluginContext, requirement: AccessRequirement): Promise<string>;
}

// ---------------------------------------------------------------------------
// Class pass partners
// ---------------------------------------------------------------------------

export interface ClassPassCheckin {
  provider: string;
  userId: string;
  sessionId: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'reconciled';
  checkedInAt?: Date;
}

export interface ClassPassProviderPlugin extends BasePlugin {
  type: 'classpass';
  /** True if the partner exposes a real-time booking API. */
  supportsRealtimeBooking: boolean;
  /** True if the partner supports batch reconciliation (file/email). */
  supportsReconciliation: boolean;
  /** True if the studio can manually mark a check-in. */
  supportsManualCheckin: boolean;
  /**
   * Attempt to book via the partner API. Returns a check-in record or null
   * to fall back to manual check-in.
   */
  book?(ctx: PluginContext, sessionId: string, userId: string): Promise<ClassPassCheckin | null>;
  /**
   * Mark an attended class as reconciled with the partner.
   */
  reconcile?(ctx: PluginContext, checkin: ClassPassCheckin): Promise<ClassPassCheckin>;
}

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

export type AnyPlugin = PaymentProviderPlugin | AccessProviderPlugin | ClassPassProviderPlugin;

export function isPaymentProvider(plugin: AnyPlugin): plugin is PaymentProviderPlugin {
  return plugin.type === 'payment';
}

export function isAccessProvider(plugin: AnyPlugin): plugin is AccessProviderPlugin {
  return plugin.type === 'access';
}

export function isClassPassProvider(plugin: AnyPlugin): plugin is ClassPassProviderPlugin {
  return plugin.type === 'classpass';
}
