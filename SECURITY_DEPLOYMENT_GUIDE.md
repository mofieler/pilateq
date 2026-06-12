# Security Deployment Guide

## 🚀 Production Deployment Checklist

This guide ensures your Pilates OS application is deployed with maximum security.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables Setup
```bash
# Required Security Variables
AUTH_SECRET=your-32-character-random-string-here
DATABASE_URL=your-secure-database-connection-string
NODE_ENV=production

# Authentication Configuration
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
AUTH_TRUST_HOST=true  # Only if behind reverse proxy
AUTH_URL=https://yourdomain.com

# Security Headers Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Optional Redis Configuration (for distributed rate limiting)
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password
REDIS_DATABASE=0
```

### 2. Dependencies Installation
```bash
# Install Redis client for production rate limiting
npm install redis @types/redis

# Or if using yarn
yarn add redis @types/redis
```

### 3. Database Security
- [ ] Database connection uses SSL/TLS
- [ ] Database credentials are environment variables, not hardcoded
- [ ] Database user has minimal required permissions
- [ ] Connection pooling configured
- [ ] Database backups encrypted

### 4. SSL/TLS Configuration
- [ ] HTTPS certificate installed and valid
- [ ] HSTS preloaded in browsers (submit to hstspreload.org)
- [ ] HTTP to HTTPS redirect configured
- [ ] TLS 1.2+ only, weak ciphers disabled

## 🔧 Infrastructure Setup

### 1. Reverse Proxy Configuration (Nginx Example)
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Next.js Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Redis Setup (Optional but Recommended)
```bash
# Docker Compose for Redis
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass your-redis-password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### 3. Firewall Configuration
```bash
# Only allow necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 6379/tcp  # Redis (if exposed internally only)
ufw enable
```

## 🔒 Security Verification

### 1. Pre-Deployment Security Tests
```bash
# Test security headers
curl -I https://yourdomain.com

# Expected headers to see:
# Content-Security-Policy: ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Test rate limiting
for i in {1..20}; do
  curl -X POST https://yourdomain.com/api/credit-purchases \
    -H "Content-Type: application/json" \
    -d '{"packageId":"test","userId":"test","paymentMethod":"stripe"}'
done
# Should return 429 after limit exceeded
```

### 2. Authentication Testing
```bash
# Test unauthenticated access
curl https://yourdomain.com/api/credit-packages
# Should return 401 for protected endpoints

# Test admin access without proper role
curl -H "Authorization: Bearer user-token" \
     https://yourdomain.com/admin/credits
# Should return 403
```

### 3. Error Message Testing
```bash
# Test that error messages don't leak information
curl -X POST https://yourdomain.com/api/credit-purchases \
  -H "Content-Type: application/json" \
  -d '{"invalid":"data"}'
# Should return generic error message, not database errors
```

## 📊 Monitoring Setup

### 1. Application Monitoring
```javascript
// Add to your monitoring service
const securityMetrics = {
  failedLogins: 0,
  rateLimitHits: 0,
  suspiciousActivity: 0,
  auditLogEntries: 0,
};

// Alert thresholds
const alertThresholds = {
  failedLoginsPerHour: 10,
  rateLimitHitsPerMinute: 5,
  suspiciousActivityPerHour: 1,
};
```

### 2. Log Aggregation
```bash
# Configure log shipping to your logging service
# Examples: ELK Stack, Splunk, Datadog, Papertrail

# Key logs to monitor:
# - Authentication failures
# - Rate limit triggers
# - Security violations
# - Database connection errors
# - System errors
```

### 3. Security Alerting
```javascript
// Example alerting setup
const securityAlerts = {
  'BRUTE_FORCE_DETECTED': {
    condition: 'failed_logins > 10 in 5 minutes',
    action: 'block_ip_temporarily',
    notification: 'security_team'
  },
  'RATE_LIMIT_ABUSE': {
    condition: 'rate_limit_hits > 50 in 1 minute',
    action: 'investigate_ip',
    notification: 'security_team'
  },
  'SUSPICIOUS_PATTERN': {
    condition: 'unusual_user_activity_detected',
    action: 'require_additional_auth',
    notification: 'user_and_security_team'
  }
};
```

## 🔄 Ongoing Maintenance

### 1. Regular Security Tasks
- [ ] Weekly: Review security logs for anomalies
- [ ] Monthly: Update dependencies and security patches
- [ ] Quarterly: Conduct security audit and penetration testing
- [ ] Annually: Review and update security policies

### 2. Dependency Security
```bash
# Audit dependencies for vulnerabilities
npm audit

# Fix any high/critical vulnerabilities
npm audit fix

# Or use automated security scanning
npm install -g audit-ci
audit-ci --moderate
```

### 3. Backup Security
- [ ] Database backups encrypted
- [ ] Backup access restricted
- [ ] Backup retention policy implemented
- [ ] Disaster recovery plan tested

## 🚨 Incident Response Plan

### 1. Security Incident Categories
- **Critical**: Data breach, system compromise
- **High**: Brute force attack, DDoS
- **Medium**: Suspicious activity pattern
- **Low**: Single failed login attempt

### 2. Response Procedures
```bash
# Immediate actions for critical incidents
1. Isolate affected systems
2. Preserve evidence (logs, memory dumps)
3. Notify security team and stakeholders
4. Activate incident response plan
5. Communicate with users if necessary
6. Investigate and contain
7. Recover and monitor
8. Post-incident review
```

### 3. Contact Information
- Security Team: security@yourcompany.com
- Incident Response: incident@yourcompany.com
- Legal Team: legal@yourcompany.com
- PR Team: pr@yourcompany.com

## 📱 Production Readiness Checklist

### Final Verification
- [ ] All environment variables set and validated
- [ ] SSL/TLS certificates installed and valid
- [ ] Security headers configured and tested
- [ ] Rate limiting functional and tested
- [ ] Authentication flows tested
- [ ] Error handling sanitized
- [ ] Audit logging functional
- [ ] Monitoring and alerting configured
- [ ] Backup systems tested
- [ ] Incident response plan ready

### Performance Considerations
- [ ] Load testing completed
- [ ] Database queries optimized
- [ ] Redis connection pooling configured
- [ ] CDN configured for static assets
- [ ] Caching strategies implemented

### Compliance Verification
- [ ] GDPR compliance checked
- [ ] Data retention policies implemented
- [ ] Privacy policy updated
- [ ] Cookie consent configured
- [ ] User data encryption verified

## 🎯 Post-Deployment

### 1. Monitoring Setup
```bash
# Set up application monitoring
# Monitor key metrics:
# - Response times
# - Error rates
# - Authentication success/failure rates
# - Rate limiting triggers
# - Database performance
# - Redis performance (if used)
```

### 2. Health Checks
```bash
# Implement health check endpoints
# GET /api/health
# Should return:
# {
#   status: "healthy",
#   timestamp: "2024-01-01T00:00:00Z",
#   services: {
#     database: "healthy",
#     redis: "healthy", // if configured
#     authentication: "healthy"
#   }
# }
```

### 3. Documentation Updates
- [ ] API documentation updated with security requirements
- [ ] Deployment documentation updated
- [ ] Security policies documented
- [ ] Incident response procedures documented

---

## 🎉 Deployment Success

Your Pilates OS application is now deployed with enterprise-grade security! 

**Key Security Features Active:**
- ✅ Comprehensive security headers
- ✅ Robust authentication and authorization
- ✅ Rate limiting and abuse prevention
- ✅ Error message sanitization
- ✅ Audit logging and monitoring
- ✅ Environment variable validation
- ✅ SSL/TLS encryption
- ✅ Security monitoring and alerting

**Next Steps:**
1. Monitor the application closely for the first 24-48 hours
2. Review security logs daily for the first week
3. Schedule regular security maintenance
4. Keep dependencies updated
5. Conduct periodic security assessments

Your application is production-ready with security best practices implemented!
