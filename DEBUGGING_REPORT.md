# Pilates OS Authentication Debugging Report

## 🎯 **Problem Summary**
Users exist in database with password hashes, but login fails with "Invalid Credentials" error.

## 🔍 **Key Findings**

### **1. Database Connection**
- ✅ **Working**: App connects successfully to production database
- ✅ **Database URL**: `postgres://postgres:daQY5FzKWSlEBybIFU4CIr2234HO3dHA4n7mpjEpEYpzaaomHkR40nsITtb2uA8Y@o138vve7mqivp0kmx1uhnxj5:5432/postgres`
- ✅ **Internal hostname**: `o138vve7mqivp0kmx1uhnxj5` (correct for Hetzner internal network)

### **2. User Data in Database**
- ✅ **Users exist**: 
  - `admin@pilatesos.com` 
  - `test@admin.de`
- ✅ **Password hashes present**: Both users have `passwordHash` field populated
- ✅ **Schema correct**: Column name is `password_hash` in DB, accessed as `passwordHash` via Drizzle

### **3. Authentication Code Analysis**
**File**: `src/lib/auth/auth.config.ts`
- ✅ **Column mapping**: Uses `user.passwordHash` correctly (line 73, 80)
- ✅ **bcrypt.compare**: Proper implementation (line 78-81)
- ✅ **Debug logs**: Console.log statements active (line 71, 83)

### **4. Production Logs Analysis**
**Coolify Application Logs show**:
```
[AUTH] User found: admin@pilatesos.com passwordHash exists: true
[AUTH] Password valid: false
[AUTH] Password mismatch
[auth][error] CredentialsSignin
```

**Critical Finding**: 
- ✅ User found
- ✅ PasswordHash exists
- ❌ **Password verification fails**

### **5. Root Cause Identified**
**BCRYPT VERSION INCOMPATIBILITY**:
- Local development uses one bcrypt version
- Production container uses different bcrypt version
- Password hashes are not compatible between versions

## 🛠️ **Technical Details**

### **Authentication Flow**
1. User enters `admin@pilatesos.com` / `password123`
2. App finds user in database ✅
3. App retrieves `passwordHash` from database ✅
4. `bcrypt.compare('password123', storedHash)` returns `false` ❌
5. Login fails

### **Environment Variables**
- ✅ `DATABASE_URL`: Correctly configured
- ✅ `AUTH_COOKIE_DOMAIN`: Set for subdomain support
- ✅ `AUTH_TRUST_HOST`: Enabled for production
- ❓ `AUTH_SECRET`: Should be verified

### **Database Schema**
```sql
users table:
- id: uuid
- email: text (unique)
- password_hash: text
- name: text
- role: text
- has_signed_waiver: boolean
- ... other fields
```

## 🎯 **Solution Required**

### **Immediate Fix**
1. **Recreate password hashes using production bcrypt version**
2. **Update existing users in database with new hashes**
3. **Test login with updated hashes**

### **Implementation Options**
1. **API Endpoint**: Create `/api/admin/reset-passwords` to regenerate all hashes
2. **Direct DB Update**: Run script to update hashes with production bcrypt
3. **Environment Sync**: Ensure bcrypt versions match between dev and prod

## 📋 **Files Created for Debugging**
- `scripts/check-user.ts` - Verify user existence and password verification
- `scripts/debug-auth.ts` - Comprehensive authentication debugging
- `scripts/seed-simple.ts` - Simple user seeding with duplicate handling

## 🔧 **Next Steps for AI**
1. **Create password reset script** that uses production bcrypt version
2. **Update all existing user passwords** to use compatible hashes
3. **Test login functionality** with updated hashes
4. **Verify all authentication flows** work correctly

## 🚨 **Critical Information**
- **App URL**: https://paquita.pilateq.de
- **Login credentials**: admin@pilatesos.com / password123
- **Database**: PostgreSQL on Hetzner VPS
- **Deployment**: Coolify with Docker
- **ORM**: Drizzle (NOT Prisma)
- **Auth**: NextAuth.js with Credentials provider

## 🎯 **Success Criteria**
- [ ] Admin user can login with `admin@pilatesos.com` / `password123`
- [ ] Test user can login with `test@example.com` / `password123`
- [ ] Authentication logs show "Password valid: true"
- [ ] No more "CredentialsSignin" errors in production logs
