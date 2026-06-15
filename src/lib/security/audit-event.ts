import { logSecurityEvent } from './audit-logger';

export interface AuditEventInput {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  studioId?: string;
  success?: boolean;
  errorMessage?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'auth' | 'financial' | 'admin' | 'user_action' | 'system';
}

/**
 * Thin wrapper around the security audit logger.
 *
 * Fires and forgets so audit logging can never block or crash the caller.
 * Supports an explicit studioId for multi-tenant contexts where the actor
 * may not yet have a resolved primary studio.
 */
export function logAuditEvent(input: AuditEventInput): void {
  void logSecurityEvent({
    userId: input.userId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    details: input.details,
    studioId: input.studioId,
    severity: input.severity ?? 'high',
    category: input.category ?? 'admin',
    success: input.success ?? true,
    errorMessage: input.errorMessage,
  });
}
