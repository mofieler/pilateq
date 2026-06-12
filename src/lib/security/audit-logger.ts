import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getStudioIdForUser } from '@/lib/studio/studio-context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('audit-logger');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'auth' | 'financial' | 'admin' | 'user_action' | 'system';
  success?: boolean;
  errorMessage?: string;
  studioId?: string;
}

export async function logSecurityEvent(entry: AuditLogEntry) {
  try {
    // Log to console for immediate visibility
    logger.info({ timestamp: new Date().toISOString(), ...entry }, 'SECURITY_AUDIT');

    if (!db) return;

    // The audit_logs table requires a real user UUID. Skip persistence for
    // synthetic actors and malformed IDs, but keep console logging.
    if (!entry.userId || !UUID_RE.test(entry.userId)) {
      return;
    }

    const severity = entry.severity ?? 'low';
    const category = entry.category ?? 'system';
    const success = entry.success ?? true;

    // Resolve tenant context when not provided explicitly
    const studioId =
      entry.studioId ??
      (entry.userId ? await getStudioIdForUser(entry.userId).catch(() => null) : null);

    // Persist to the dedicated audit_logs table without blocking the caller
    void db
      .insert(auditLogs)
      .values({
        userId: entry.userId,
        studioId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        severity,
        category,
        success,
        errorMessage: entry.errorMessage,
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to persist security audit event');
      });
  } catch (error) {
    logger.error({ err: error }, 'Failed to log security event');
  }
}

export async function logFinancialOperation(
  userId: string,
  operation: 'purchase' | 'refund' | 'adjustment',
  details: {
    amount: number;
    creditType: string;
    referenceId?: string;
    description: string;
  },
) {
  try {
    await logSecurityEvent({
      userId,
      action: `financial_${operation}`,
      resource: 'credits',
      resourceId: details.referenceId,
      details: {
        amount: details.amount,
        creditType: details.creditType,
        description: details.description,
      },
      category: 'financial',
      success: true,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to log financial operation');
  }
}
