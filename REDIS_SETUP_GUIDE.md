# Redis Setup Guide for VPS Deployment

## 💰 Redis Cost Options

### **Free Options:**
1. **Self-hosted Redis on your VPS** - **FREE** (recommended for your case)
2. **Redis Cloud Free Tier** - 30MB database, limited connections
3. **Docker Redis** - Free, easy to manage

### **Paid Options:**
1. **Redis Cloud** - Starts at ~$7/month for small instances
2. **AWS ElastiCache** - Pay-as-you-go, ~$0.018/hour for cache.t3.micro
3. **DigitalOcean Redis** - Starts at $15/month
4. **Heroku Redis** - Starts at $15/month

## 🚀 Recommended Setup for Your VPS

### **Option 1: Self-Hosted Redis (FREE & Recommended)**

#### **Step 1: Install Redis on Ubuntu/Debian**
```bash
# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis service
sudo systemctl start redis-server

# Enable Redis to start on boot
sudo systemctl enable redis-server

# Check Redis status
sudo systemctl status redis-server
```

#### **Step 2: Configure Redis for Security**
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf
```

**Important settings to update:**
```conf
# Bind to localhost only (security)
bind 127.0.0.1

# Set a password (required for security)
requirepass your-secure-redis-password-here

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG ""
rename-command SHUTDOWN ""
rename-command DEBUG ""

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru
```

#### **Step 3: Restart Redis with new config**
```bash
sudo systemctl restart redis-server

# Test connection
redis-cli -a your-secure-redis-password ping
# Should return: PONG
```

#### **Step 4: Configure Firewall**
```bash
# If using UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
# Redis is bound to localhost, so no need to open port 6379
sudo ufw enable
```

### **Option 2: Docker Redis (Alternative)**

#### **Step 1: Install Docker**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

#### **Step 2: Create Redis Container**
```bash
# Create Redis container with persistence
docker run -d \
  --name redis-pilatesos \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --requirepass your-secure-redis-password --appendonly yes
```

#### **Step 3: Test Docker Redis**
```bash
docker exec -it redis-pilatesos redis-cli -a your-secure-redis-password ping
```

## 🔧 Environment Configuration

### **Update your .env file:**
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-secure-redis-password-here
REDIS_DATABASE=0

# Security Monitoring (Optional but Recommended)
SECURITY_MONITORING_ENABLED=true
SECURITY_FAILED_LOGIN_THRESHOLD=5
SECURITY_RATE_LIMIT_THRESHOLD=20
SECURITY_ALERT_EMAIL=your-email@yourdomain.com
```

### **For Docker Redis:**
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-secure-redis-password-here
REDIS_DATABASE=0
```

## 📊 Redis Resource Requirements

### **Minimum Requirements:**
- **RAM**: 256MB - 512MB
- **CPU**: 0.1 - 0.5 cores
- **Storage**: 100MB - 1GB (for persistence)
- **Network**: Minimal (localhost only)

### **For Your Pilates OS App:**
- **Light usage**: 256MB RAM sufficient
- **Medium usage**: 512MB RAM recommended
- **High usage**: 1GB RAM for heavy rate limiting

## 🔒 Security Best Practices

### **1. Network Security**
```bash
# Redis should only bind to localhost
netstat -tuln | grep 6379
# Should show: 127.0.0.1:6379 (NOT 0.0.0.0:6379)
```

### **2. Authentication**
```bash
# Always use a strong password
redis-cli -a your-password config set requirepass your-new-password
```

### **3. Disable Dangerous Commands**
```bash
# In redis.conf, disable commands that could be abused
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
```

### **4. Regular Updates**
```bash
# Keep Redis updated
sudo apt update && sudo apt upgrade redis-server
```

## 🚀 Testing Redis Setup

### **Step 1: Test Basic Connection**
```bash
# Test Redis connection
redis-cli -a your-password ping

# Test in your app
node -e "
const redis = require('redis');
const client = redis.createClient({ url: 'redis://localhost:6379' });
client.connect().then(() => {
  console.log('Redis connected successfully');
  client.disconnect();
}).catch(err => console.log('Redis connection failed:', err));
"
```

### **Step 2: Test Rate Limiting**
```bash
# Install Redis client if not already done
npm install redis @types/redis

# Test your app's rate limiting
curl -X POST http://localhost:3000/api/credit-purchases \
  -H "Content-Type: application/json" \
  -d '{"packageId":"test","userId":"test","paymentMethod":"stripe"}'

# Repeat multiple times to test rate limiting
```

### **Step 3: Monitor Redis Performance**
```bash
# Check Redis info
redis-cli -a your-password info memory
redis-cli -a your-password info stats
redis-cli -a your-password info clients
```

## 📈 Redis Monitoring

### **Basic Monitoring Commands:**
```bash
# Check Redis status
sudo systemctl status redis-server

# Monitor Redis in real-time
redis-cli -a your-password monitor

# Check memory usage
redis-cli -a your-password info memory | grep used_memory

# Check connected clients
redis-cli -a your-password info clients
```

### **Log Monitoring:**
```bash
# Redis logs location
tail -f /var/log/redis/redis-server.log

# Or for Docker
docker logs -f redis-pilatesos
```

## 🔄 Backup and Persistence

### **Redis Persistence Setup:**
```conf
# In /etc/redis/redis.conf
save 900 1    # Save after 900 seconds if 1 key changed
save 300 10   # Save after 300 seconds if 10 keys changed
save 60 10000 # Save after 60 seconds if 10000 keys changed

# RDB settings
dbfilename dump.rdb
dir /var/lib/redis
```

### **Backup Script:**
```bash
#!/bin/bash
# backup-redis.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/redis"
mkdir -p $BACKUP_DIR

# Create backup
redis-cli -a your-password --rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "redis_backup_*.rdb" -mtime +7 -delete

echo "Redis backup completed: $BACKUP_DIR/redis_backup_$DATE.rdb"
```

## 🚨 Troubleshooting

### **Common Issues:**

#### **1. Redis Connection Failed**
```bash
# Check if Redis is running
sudo systemctl status redis-server

# Check if Redis is listening on correct port
netstat -tuln | grep 6379

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

#### **2. Permission Denied**
```bash
# Check Redis configuration
sudo nano /etc/redis/redis.conf

# Ensure password is set correctly
requirepass your-password
```

#### **3. Memory Issues**
```bash
# Check Redis memory usage
redis-cli -a your-password info memory

# Clear Redis cache (if needed)
redis-cli -a your-password FLUSHALL
```

#### **4. Docker Issues**
```bash
# Check Docker container status
docker ps -a | grep redis

# View Docker logs
docker logs redis-pilatesos

# Restart Docker container
docker restart redis-pilatesos
```

## 🎯 Cost Summary

### **FREE Setup (Recommended):**
- **Redis Server**: $0 (self-hosted)
- **VPS Resources**: ~$5-10/month additional RAM/CPU
- **Setup Time**: 30 minutes
- **Maintenance**: Minimal

### **Paid Cloud Options:**
- **Redis Cloud**: ~$7-50/month
- **AWS ElastiCache**: ~$15-100/month
- **DigitalOcean**: ~$15-30/month

## 📋 Final Checklist

- [ ] Redis installed and running
- [ ] Password authentication configured
- [ ] Dangerous commands disabled
- [ ] Firewall configured correctly
- [ ] Environment variables updated
- [ ] Application connects to Redis
- [ ] Rate limiting working
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented
- [ ] Security testing completed

---

**Bottom Line**: Use the **self-hosted Redis option** - it's completely free and perfect for your VPS setup. You'll only need minimal additional resources (256MB RAM) and it provides enterprise-grade rate limiting for your application.
