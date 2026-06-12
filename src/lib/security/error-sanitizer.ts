import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger('error-sanitizer');

// Public-safe error messages
const PUBLIC_ERROR_MESSAGES: Record<ServiceErrorCode, string> = {
  'NOT_FOUND': 'The requested resource was not found.',
  'UNAUTHORIZED': 'You are not authorized to perform this action.',
  'ALREADY_CANCELLED': 'This item has already been cancelled.',
  'INSUFFICIENT_CREDITS': 'You have insufficient credits for this action.',
  'BOOKING_ALREADY_EXISTS': 'You already have a booking for this class.',
  'CLASS_FULL': 'This class is full.',
  'OUTSIDE_CANCELLATION_WINDOW': 'Cancellation is no longer available for this booking.',
  'WAITLIST_FULL': 'The waitlist for this class is full.',
  'ALREADY_ON_WAITLIST': 'You are already on the waitlist for this class.',
  'OFFER_EXPIRED': 'This offer has expired.',
  'INVALID_STATE': 'The action cannot be completed at this time.',
  'DUPLICATE_PAYMENT': 'This payment has already been processed.',
  'DB_ERROR': 'An unexpected error occurred. Please try again.',
  'RATE_LIMITED': 'Too many requests. Please try again later.',
  'OVERDUE_BILLS': 'You have overdue invoices. Please settle them at the studio or via bank transfer first.',
  'WELCOME_REQUIRED': 'Please complete your Welcome Journey first. Buy the Welcome Journey package, attend your intro session, then unlock all other packages.',
  'WAIVER_REQUIRED': 'Please sign the required waiver before proceeding.',
};

// Internal error codes that should never be exposed to users
const INTERNAL_ERROR_CODES = [
  'DATABASE_CONNECTION_FAILED',
  'QUERY_EXECUTION_ERROR',
  'TRANSACTION_ROLLBACK',
  'MIGRATION_ERROR',
  'CACHE_ERROR',
  'EXTERNAL_SERVICE_ERROR',
] as const;

type InternalErrorCode = typeof INTERNAL_ERROR_CODES[number];

// Sanitize error messages for public consumption
export function sanitizeError(error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  // If it's a ServiceResult with known error code
  if (error && typeof error === 'object' && 'code' in error && 'error' in error) {
    const serviceError = error as { code: ServiceErrorCode; error: string };
    return PUBLIC_ERROR_MESSAGES[serviceError.code] || fallbackMessage;
  }

  // If it's a string with known error code
  if (typeof error === 'string') {
    const upperError = error.toUpperCase();
    const matchedCode = Object.keys(PUBLIC_ERROR_MESSAGES).find(
      code => upperError.includes(code)
    ) as ServiceErrorCode;
    
    if (matchedCode) {
      return PUBLIC_ERROR_MESSAGES[matchedCode];
    }
  }

  // Check for internal error patterns
  if (typeof error === 'string') {
    const upperError = error.toUpperCase();
    if (INTERNAL_ERROR_CODES.some(code => upperError.includes(code))) {
      return fallbackMessage;
    }
    
    // Check for database-specific patterns that shouldn't be exposed
    if (upperError.includes('SQL') || upperError.includes('DATABASE') || 
        upperError.includes('POSTGRES') || upperError.includes('DRIZZLE')) {
      return fallbackMessage;
    }
    
    // Check for file system patterns
    if (upperError.includes('ENOENT') || upperError.includes('EACCES') || 
        upperError.includes('FILESYSTEM') || upperError.includes('PATH')) {
      return fallbackMessage;
    }
    
    // Check for internal server patterns
    if (upperError.includes('INTERNAL') || upperError.includes('SYSTEM') || 
        upperError.includes('SERVER') || upperError.includes('INFRASTRUCTURE')) {
      return fallbackMessage;
    }
  }

  // For Error objects, check the message
  if (error instanceof Error) {
    return sanitizeError(error.message, fallbackMessage);
  }

  // Default fallback
  return fallbackMessage;
}

// Create a safe ServiceResult for public consumption
export function createSafeServiceResult<T>(
  result: ServiceResult<T>,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): ServiceResult<T> {
  if (!result.success) {
    return {
      success: false,
      error: sanitizeError(result.error, fallbackMessage),
      code: result.code
    };
  }
  return result;
}

// Log internal errors while returning safe messages
export function logAndSanitizeError(
  error: unknown,
  context: string,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  // Log the full error for debugging
  logger.error({ err: error, context }, 'Internal error');

  // Return sanitized message
  return sanitizeError(error, fallbackMessage);
}

function hasCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Check if an error should be treated as internal
export function isInternalError(error: unknown): boolean {
  if (typeof error === 'string') {
    const upperError = error.toUpperCase();
    return INTERNAL_ERROR_CODES.some(code => upperError.includes(code)) ||
           upperError.includes('SQL') ||
           upperError.includes('DATABASE') ||
           upperError.includes('POSTGRES') ||
           upperError.includes('DRIZZLE') ||
           upperError.includes('INTERNAL') ||
           upperError.includes('SYSTEM') ||
           upperError.includes('SERVER');
  }
  return false;
}

// API route helper to standardize error responses
export function handleApiError(error: unknown, context: string) {
  const sanitizedMessage = logAndSanitizeError(error, context);
  
  // Determine appropriate HTTP status
  let status = 500;
  if (hasCode(error)) {
    const errorCode = error.code as ServiceErrorCode;
    switch (errorCode) {
      case 'UNAUTHORIZED': status = 401; break;
      case 'NOT_FOUND': status = 404; break;
      case 'INVALID_STATE': status = 400; break;
      case 'INSUFFICIENT_CREDITS': status = 402; break;
      case 'RATE_LIMITED': status = 429; break;
      case 'WELCOME_REQUIRED': status = 403; break;
      case 'WAIVER_REQUIRED': status = 403; break;
      default: status = 500;
    }
  }

  return {
    success: false,
    error: sanitizedMessage,
    code: isInternalError(error) ? 'INTERNAL_ERROR' : (hasCode(error) ? error.code : 'UNKNOWN_ERROR')
  };
}
