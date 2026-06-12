/**
 * Application Configuration Constants
 * Centralized configuration for app-wide settings
 */

import { STUDIO_TIMEZONE } from './BOOKING_RULES';

export const APP_CONFIG = {
  // URLs - should come from environment variables in production
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  
  // App metadata
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'PilatesOS',
  APP_DESCRIPTION: 'Pilates Studio Management Platform',
  
  // Security
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Timezone
  DEFAULT_TIMEZONE: STUDIO_TIMEZONE,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // File uploads
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  
  // Cache settings
  CACHE_TTL_SECONDS: 3600, // 1 hour

  // Token expiry
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 60,

  // Features
  FEATURES: {
    STRIPE_ENABLED: process.env.STRIPE_SECRET_KEY ? true : false,
    EMAIL_ENABLED: process.env.RESEND_API_KEY ? true : false,
    VOD_ENABLED: process.env.AWS_S3_BUCKET ? true : false,
  },
} as const;
