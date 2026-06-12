import { z } from 'zod';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

// Environment variable schema with validation
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Auth
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  AUTH_URL: z.string().optional(),
  
  // Security
  ALLOWED_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Application
  NEXTAUTH_URL: z.string().optional(),
  PORT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Validate environment variables at startup
function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    
    // Additional validation logic
    if (env.NODE_ENV === 'production') {
      // Production-specific checks
      if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
        throw new Error('AUTH_SECRET must be at least 32 characters in production');
      }
      
      if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in production');
      }
      
      // Check for HTTPS in production
      if (env.NEXTAUTH_URL && !env.NEXTAUTH_URL.startsWith('https://')) {
        console.warn('WARNING: NEXTAUTH_URL should use HTTPS in production');
      }
    }
    
    // OAuth provider validation
    if (env.AUTH_GOOGLE_ID && !env.AUTH_GOOGLE_SECRET) {
      throw new Error('AUTH_GOOGLE_SECRET is required when AUTH_GOOGLE_ID is provided');
    }
    
    if (env.AUTH_GOOGLE_SECRET && !env.AUTH_GOOGLE_ID) {
      throw new Error('AUTH_GOOGLE_ID is required when AUTH_GOOGLE_SECRET is provided');
    }
    
    return env;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

// Export validated environment variables
export const env = validateEnv();

// Runtime validation helper for critical operations
export function requireEnv(key: keyof Env): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  return value;
}

// Safe environment access with fallback
export function getEnv(key: keyof Env, fallback?: string): string | undefined {
  return env[key] || fallback;
}

// Export common environment checks
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Security configuration helpers
export const securityConfig = {
  trustHost: env.AUTH_TRUST_HOST === 'true',
  useSecureCookies: isProduction,
  allowedOrigins: APP_CONFIG.ALLOWED_ORIGINS,
  enableHsts: isProduction,
} as const;
