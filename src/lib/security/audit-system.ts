import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getStudioIdForUser } from '@/lib/studio/studio-context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('audit-system');
const auditLoggerFailure = getLogger('audit');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dedicated audit log entry types
export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'financial' | 'admin' | 'user_action' | 'system';
  success: boolean;
  errorMessage?: string;
  studioId?: string;
}

// Audit logging service
export class AuditLogger {
  private static instance: AuditLogger;

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Log a security event
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    try {
      // Log to console for immediate visibility in development
      if (process.env.NODE_ENV === 'development') {
        logger.info(auditEntry, 'AUDIT_LOG');
      }

      // Persist to the database without blocking the hot path
      if (db) {
        void this.persist(auditEntry).catch((error) => {
          logger.error({ err: error }, 'Failed to persist audit entry');
        });
      }

      // Could also send to external logging service
      await this.sendToExternalService(auditEntry);
    } catch (error) {
      logger.error({ err: error }, 'Failed to log audit entry');
      // Audit logging failures should not crash the application
    }
  }

  // Persist the entry to the audit_logs table
  private async persist(entry: AuditLogEntry): Promise<void> {
    // The schema requires a real user UUID. Skip persistence for synthetic
    // actors (system, anonymous) and malformed IDs, but keep console logging.
    if (!entry.userId || !UUID_RE.test(entry.userId)) {
      return;
    }

    let studioId = entry.studioId;

    // Resolve studioId from the user when it was not provided explicitly.
    // Skip resolution for synthetic actors to avoid unnecessary DB round-trips.
    if (
      !studioId &&
      entry.userId &&
      entry.userId !== 'system' &&
      entry.userId !== 'anonymous'
    ) {
      studioId = (await getStudioIdForUser(entry.userId).catch(() => null)) ?? undefined;
    }

    await db.insert(auditLogs).values({
      userId: entry.userId,
      studioId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      severity: entry.severity,
      category: entry.category,
      success: entry.success,
      errorMessage: entry.errorMessage,
    });
  }

  // Log authentication events
  async logAuthEvent(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'account_locked',
    success: boolean,
    details?: Record<string, any>,
    errorMessage?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'authentication',
      details,
      success,
      errorMessage,
      severity: this.getSeverityForAuth(action, success),
      category: 'auth',
    });
  }

  // Log financial events
  async logFinancialEvent(entry: Omit<AuditLogEntry, 'category'>): Promise<void> {
    await this.log({ ...entry, category: 'financial' });
  }

  // Log admin actions
  async logAdminAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    success: boolean = true,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      success,
      severity: 'high',
      category: 'admin',
    });
  }

  // Log user actions
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    success: boolean = true,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      success,
      severity: 'low',
      category: 'user_action',
    });
  }

  // Log system events
  async logSystemEvent(
    action: string,
    details?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): Promise<void> {
    await this.log({
      userId: 'system',
      action,
      resource: 'system',
      details,
      success: true,
      severity,
      category: 'system',
    });
  }

  // Get severity level for authentication events
  private getSeverityForAuth(
    action: string,
    success: boolean,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      if (action === 'login_failed') return 'medium';
      if (action === 'account_locked') return 'high';
    }
    return 'low';
  }

  // Send to external logging service (placeholder)
  private async sendToExternalService(entry: AuditLogEntry): Promise<void> {
    // In production, this could send to:
    // - Elasticsearch
    // - Splunk
    // - Datadog
    // - Custom logging API
    // - SIEM system

    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external service
      // await fetch('https://logging-service.example.com/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    }
  }

  // Query audit logs (for admin dashboards)
  async queryLogs(filters: {
    userId?: string;
    category?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    // TODO: implement query against audit_logs once admin dashboard needs it
    logger.info({ filters }, 'AUDIT_QUERY');
    return [];
  }

  // Get security metrics
  async getSecurityMetrics(timeframe: 'hour' | 'day' | 'week' | 'month') {
    // TODO: aggregate audit_logs once admin dashboard needs it
    logger.info({ timeframe }, 'AUDIT_METRICS');
    return {
      totalEvents: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      adminActions: 0,
      financialTransactions: 0,
    };
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Helper functions for common audit scenarios
export const auditHelpers = {
  // User login
  logUserLogin: async (userId: string, ip?: string, userAgent?: string) => {
    await auditLogger.logAuthEvent(userId, 'login', true, {
      loginTime: new Date().toISOString(),
      ip,
      userAgent,
    });
  },

  // Failed login attempt
  logFailedLogin: async (email: string, ip?: string, userAgent?: string, reason?: string) => {
    await auditLogger.log({
      userId: 'anonymous',
      action: 'login_failed',
      resource: 'authentication',
      details: { email, ip, userAgent, reason },
      success: false,
      severity: 'medium',
      category: 'auth',
      errorMessage: reason,
    });
  },

  // Credit purchase
  logCreditPurchase: async (
    userId: string,
    amount: number,
    creditType: string,
    success: boolean,
    error?: string,
  ) => {
    await auditLogger.log({
      userId,
      action: 'credit_purchase',
      resource: 'credits',
      details: { amount, creditType },
      success,
      errorMessage: error,
      severity: success ? 'low' : 'high',
      category: 'financial',
    });
  },

  // Booking cancellation
  logBookingCancellation: async (
    userId: string,
    bookingId: string,
    success: boolean,
    reason?: string,
  ) => {
    await auditLogger.log({
      userId,
      action: 'booking_cancel',
      resource: 'booking',
      resourceId: bookingId,
      details: { reason },
      success,
      errorMessage: reason,
      severity: 'low',
      category: 'user_action',
    });
  },

  // Admin action — fire-and-forget so audit logging never blocks or crashes the request.
  logAdminAction: (
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    success: boolean = true,
  ) => {
    Promise.resolve()
      .then(() => auditLogger.logAdminAction(userId, action, resource, resourceId, details, success))
      .catch((error) => {
        auditLoggerFailure.error(
          { err: error, userId, action, resource, resourceId },
          'Failed to log admin action',
        );
      });
  },

  // Security violation
  logSecurityViolation: async (
    userId: string,
    violation: string,
    details?: Record<string, any>,
  ) => {
    await auditLogger.log({
      userId,
      action: 'security_violation',
      resource: 'security',
      details: { violation, ...details },
      success: false,
      severity: 'critical',
      category: 'system',
      errorMessage: violation,
    });
  },
};
