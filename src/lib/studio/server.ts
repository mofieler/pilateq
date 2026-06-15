/**
 * Server-only studio module exports.
 *
 * This file aggregates all studio utilities that depend on Node.js-only or
 * React Server Component APIs (next/headers, react cache, db, drizzle-orm).
 * Import from here in API routes, Server Components, Server Actions, and auth
 * config. Client components must NOT import from this file.
 */

export {
  getStudioConfig,
  getStudioConfigContext,
  getStudioConfigForHostname,
  getStudioConfigSync,
} from './studio.config.loader';
export type { StudioConfigContext } from './studio.config.loader';

export {
  resolveStudioFromHostname,
  resolveDefaultStudio,
} from './studio.resolver';
export type { ResolvedStudio } from './studio.resolver';

export type { TenantResolution } from './studio.config.tenant';

export {
  MembershipError,
  getMembership,
  requireMembership,
  getUserMemberships,
  getActiveMembership,
  createMembership,
  updateMembershipRole,
  removeMembership,
  hasRole,
  createStudioInvite,
  getStudioInviteByTokenHash,
  markStudioInviteUsed,
} from './membership';
export type { StudioMembership, StudioMembershipRole } from '@/db/schema';
