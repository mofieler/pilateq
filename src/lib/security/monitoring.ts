import { auditLogger } from './audit-system';

// Security monitoring configuration
export interface SecurityConfig {
  alertThresholds: {
    failedLoginsPerMinute: number;
    rateLimitHitsPerMinute: number;
    suspiciousActivityPerHour: number;
    adminActionsPerHour: number;
    financialTransactionsPerMinute: number;
  };
  notificationChannels: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
  monitoringEnabled: boolean;
}

// Security event types
export type SecurityEventType = 
  | 'brute_force_attack'
  | 'rate_limit_abuse'
  | 'suspicious_activity'
  | 'admin_privilege_escalation'
  | 'financial_anomaly'
  | 'data_breach_attempt'
  | 'system_compromise';

// Security alert interface
export interface SecurityAlert {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  details: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Security metrics
export interface SecurityMetrics {
  timestamp: Date;
  failedLogins: number;
  successfulLogins: number;
  rateLimitHits: number;
  suspiciousActivity: number;
  adminActions: number;
  financialTransactions: number;
  uniqueUsers: number;
  uniqueIPs: number;
}

class SecurityMonitor {
  private static instance: SecurityMonitor;
  private config: SecurityConfig;
  private metrics: Map<string, number> = new Map();
  private alerts: SecurityAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  constructor() {
    this.config = this.loadConfig();
    if (this.config.monitoringEnabled) {
      // Guard against HMR creating duplicate intervals in dev
      const globalKey = '__pilatesos_monitor_interval';
      if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
        clearInterval((globalThis as any)[globalKey]);
      }
      this.startMonitoring();
      if (typeof globalThis !== 'undefined') {
        (globalThis as any)[globalKey] = this.monitoringInterval;
      }
    }
  }

  private loadConfig(): SecurityConfig {
    return {
      alertThresholds: {
        failedLoginsPerMinute: parseInt(process.env.SECURITY_FAILED_LOGIN_THRESHOLD || '5'),
        rateLimitHitsPerMinute: parseInt(process.env.SECURITY_RATE_LIMIT_THRESHOLD || '20'),
        suspiciousActivityPerHour: parseInt(process.env.SECURITY_SUSPICIOUS_THRESHOLD || '10'),
        adminActionsPerHour: parseInt(process.env.SECURITY_ADMIN_ACTION_THRESHOLD || '50'),
        financialTransactionsPerMinute: parseInt(process.env.SECURITY_FINANCIAL_THRESHOLD || '15'),
      },
      notificationChannels: {
        email: process.env.SECURITY_ALERT_EMAIL?.split(',') || [],
        slack: process.env.SECURITY_SLACK_WEBHOOK,
        webhook: process.env.SECURITY_WEBHOOK_URL,
      },
      monitoringEnabled: process.env.SECURITY_MONITORING_ENABLED === 'true',
    };
  }

  private startMonitoring(): void {
    // Collect metrics every minute
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMetrics();
    }, 60000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      // This would query the audit logs for metrics
      // For now, we'll use in-memory tracking
      const metrics: SecurityMetrics = {
        timestamp: now,
        failedLogins: this.metrics.get('failedLogins') || 0,
        successfulLogins: this.metrics.get('successfulLogins') || 0,
        rateLimitHits: this.metrics.get('rateLimitHits') || 0,
        suspiciousActivity: this.metrics.get('suspiciousActivity') || 0,
        adminActions: this.metrics.get('adminActions') || 0,
        financialTransactions: this.metrics.get('financialTransactions') || 0,
        uniqueUsers: this.metrics.get('uniqueUsers') || 0,
        uniqueIPs: this.metrics.get('uniqueIPs') || 0,
      };

      // Reset counters for next minute
      this.metrics.clear();
      
      // Store metrics for analysis
      await this.storeMetrics(metrics);
      
    } catch (error) {
      console.error('Error collecting security metrics:', error);
    }
  }

  private async storeMetrics(metrics: SecurityMetrics): Promise<void> {
    // In production, this would store to a time-series database
    // For now, just log the metrics
    console.log('SECURITY_METRICS:', JSON.stringify(metrics));
  }

  private analyzeMetrics(): void {
    // Analyze metrics and trigger alerts if thresholds are exceeded
    const metrics = this.getCurrentMetrics();
    
    if (metrics.failedLogins > this.config.alertThresholds.failedLoginsPerMinute) {
      this.triggerAlert({
        id: this.generateAlertId(),
        type: 'brute_force_attack',
        severity: 'high',
        timestamp: new Date(),
        description: `High number of failed login attempts: ${metrics.failedLogins} per minute`,
        details: { failedLogins: metrics.failedLogins, threshold: this.config.alertThresholds.failedLoginsPerMinute },
        resolved: false,
      });
    }

    if (metrics.rateLimitHits > this.config.alertThresholds.rateLimitHitsPerMinute) {
      this.triggerAlert({
        id: this.generateAlertId(),
        type: 'rate_limit_abuse',
        severity: 'medium',
        timestamp: new Date(),
        description: `High rate limit hits: ${metrics.rateLimitHits} per minute`,
        details: { rateLimitHits: metrics.rateLimitHits, threshold: this.config.alertThresholds.rateLimitHitsPerMinute },
        resolved: false,
      });
    }

    if (metrics.suspiciousActivity > this.config.alertThresholds.suspiciousActivityPerHour / 60) {
      this.triggerAlert({
        id: this.generateAlertId(),
        type: 'suspicious_activity',
        severity: 'medium',
        timestamp: new Date(),
        description: `Suspicious activity detected: ${metrics.suspiciousActivity} events per minute`,
        details: { suspiciousActivity: metrics.suspiciousActivity },
        resolved: false,
      });
    }
  }

  private getCurrentMetrics(): SecurityMetrics {
    return {
      timestamp: new Date(),
      failedLogins: this.metrics.get('failedLogins') || 0,
      successfulLogins: this.metrics.get('successfulLogins') || 0,
      rateLimitHits: this.metrics.get('rateLimitHits') || 0,
      suspiciousActivity: this.metrics.get('suspiciousActivity') || 0,
      adminActions: this.metrics.get('adminActions') || 0,
      financialTransactions: this.metrics.get('financialTransactions') || 0,
      uniqueUsers: this.metrics.get('uniqueUsers') || 0,
      uniqueIPs: this.metrics.get('uniqueIPs') || 0,
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async triggerAlert(alert: SecurityAlert): Promise<void> {
    try {
      // Store alert
      this.alerts.push(alert);
      // Prune old alerts to prevent unbounded memory growth
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-500);
      }
      
      // Log alert
      console.warn('SECURITY_ALERT:', JSON.stringify(alert));
      
      // Send notifications
      await this.sendNotifications(alert);
      
      // Take automatic protective measures
      await this.takeProtectiveMeasures(alert);
      
    } catch (error) {
      console.error('Error triggering security alert:', error);
    }
  }

  private async sendNotifications(alert: SecurityAlert): Promise<void> {
    const message = this.formatAlertMessage(alert);
    
    // Send email notifications
    if (this.config.notificationChannels.email?.length) {
      await this.sendEmailNotifications(this.config.notificationChannels.email, message, alert.severity);
    }
    
    // Send Slack notification
    if (this.config.notificationChannels.slack) {
      await this.sendSlackNotification(this.config.notificationChannels.slack, message, alert.severity);
    }
    
    // Send webhook notification
    if (this.config.notificationChannels.webhook) {
      await this.sendWebhookNotification(this.config.notificationChannels.webhook, alert);
    }
  }

  private formatAlertMessage(alert: SecurityAlert): string {
    return `
🚨 SECURITY ALERT: ${alert.type.toUpperCase()}

Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp.toISOString()}
Description: ${alert.description}

Details: ${JSON.stringify(alert.details, null, 2)}

Immediate action required.
    `.trim();
  }

  private async sendEmailNotifications(emails: string[], message: string, severity: string): Promise<void> {
    // Implementation would depend on your email service
    console.log(`EMAIL ALERT (${severity}):`, message);
    console.log('Recipients:', emails);
  }

  private async sendSlackNotification(webhookUrl: string, message: string, severity: string): Promise<void> {
    try {
      const payload = {
        text: `🚨 Security Alert (${severity.toUpperCase()})`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Security Alert: ${severity.toUpperCase()}*\n${message}`
            }
          }
        ]
      };

      // In production, this would make an actual HTTP request
      console.log(`SLACK ALERT (${severity}):`, payload);
      
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  private async sendWebhookNotification(webhookUrl: string, alert: SecurityAlert): Promise<void> {
    try {
      // In production, this would make an actual HTTP request
      console.log(`WEBHOOK ALERT:`, { url: webhookUrl, alert });
      
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  private async takeProtectiveMeasures(alert: SecurityAlert): Promise<void> {
    switch (alert.type) {
      case 'brute_force_attack':
        await this.handleBruteForceAttack(alert);
        break;
      case 'rate_limit_abuse':
        await this.handleRateLimitAbuse(alert);
        break;
      case 'suspicious_activity':
        await this.handleSuspiciousActivity(alert);
        break;
      case 'data_breach_attempt':
        await this.handleDataBreachAttempt(alert);
        break;
    }
  }

  private async handleBruteForceAttack(alert: SecurityAlert): Promise<void> {
    // Block IP temporarily
    const ip = alert.details.ipAddress;
    if (ip) {
      console.log(`Blocking IP ${ip} due to brute force attack`);
      // In production, this would update firewall rules or Redis block list
    }
  }

  private async handleRateLimitAbuse(alert: SecurityAlert): Promise<void> {
    // Increase rate limiting strictness
    console.log('Increasing rate limiting strictness due to abuse');
    // In production, this would update rate limit configurations
  }

  private async handleSuspiciousActivity(alert: SecurityAlert): Promise<void> {
    // Require additional authentication
    if (alert.userId) {
      console.log(`Requiring additional authentication for user ${alert.userId}`);
      // In production, this would trigger MFA requirement
    }
  }

  private async handleDataBreachAttempt(alert: SecurityAlert): Promise<void> {
    // Lock down affected accounts
    console.log('Initiating security lockdown due to data breach attempt');
    // In production, this would lock accounts and trigger incident response
  }

  // Public methods for manual security event tracking
  public trackFailedLogin(ipAddress?: string, userAgent?: string): void {
    this.metrics.set('failedLogins', (this.metrics.get('failedLogins') || 0) + 1);
  }

  public trackSuccessfulLogin(): void {
    this.metrics.set('successfulLogins', (this.metrics.get('successfulLogins') || 0) + 1);
  }

  public trackRateLimitHit(ipAddress?: string): void {
    this.metrics.set('rateLimitHits', (this.metrics.get('rateLimitHits') || 0) + 1);
  }

  public trackSuspiciousActivity(details: Record<string, any>): void {
    this.metrics.set('suspiciousActivity', (this.metrics.get('suspiciousActivity') || 0) + 1);
  }

  public trackAdminAction(userId: string): void {
    this.metrics.set('adminActions', (this.metrics.get('adminActions') || 0) + 1);
  }

  public trackFinancialTransaction(): void {
    this.metrics.set('financialTransactions', (this.metrics.get('financialTransactions') || 0) + 1);
  }

  // Manual alert triggering
  public async createManualAlert(type: SecurityEventType, description: string, details: Record<string, any>): Promise<void> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      type,
      severity: 'medium',
      timestamp: new Date(),
      description,
      details,
      resolved: false,
    };

    await this.triggerAlert(alert);
  }

  // Alert management
  public getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  public resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;
      
      console.log(`Security alert ${alertId} resolved by ${resolvedBy}`);
    }
  }

  public getSecurityMetrics(hours: number = 24): SecurityMetrics[] {
    // In production, this would query stored metrics
    // For now, return current metrics
    return [this.getCurrentMetrics()];
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();

// Helper functions for tracking security events
export const securityTracking = {
  failedLogin: (ipAddress?: string, userAgent?: string) => {
    securityMonitor.trackFailedLogin(ipAddress, userAgent);
  },
  
  successfulLogin: () => {
    securityMonitor.trackSuccessfulLogin();
  },
  
  rateLimitHit: (ipAddress?: string) => {
    securityMonitor.trackRateLimitHit(ipAddress);
  },
  
  suspiciousActivity: (details: Record<string, any>) => {
    securityMonitor.trackSuspiciousActivity(details);
  },
  
  adminAction: (userId: string) => {
    securityMonitor.trackAdminAction(userId);
  },
  
  financialTransaction: () => {
    securityMonitor.trackFinancialTransaction();
  },
  
  manualAlert: async (type: SecurityEventType, description: string, details: Record<string, any>) => {
    await securityMonitor.createManualAlert(type, description, details);
  },
};
