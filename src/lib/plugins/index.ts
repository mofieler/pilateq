/**
 * Plugin system public API.
 */

export type {
  AnyPlugin,
  BasePlugin,
  PluginContext,
  PaymentProviderPlugin,
  PaymentIntent,
  CreatePaymentInput,
  AccessProviderPlugin,
  AccessGrant,
  AccessRequirement,
  ClassPassProviderPlugin,
  ClassPassCheckin,
} from './types';

export {
  isPaymentProvider,
  isAccessProvider,
  isClassPassProvider,
} from './types';

export {
  ALL_PLUGINS,
  getPluginByKey,
  getPaymentProviderPlugins,
  getAccessProviderPlugins,
  getClassPassProviderPlugins,
  getEnabledAccessPlugins,
  getEnabledPaymentPlugins,
} from './registry';
