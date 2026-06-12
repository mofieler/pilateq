/**
 * Database Configuration Constants
 * Centralized configuration for database settings
 */

export const DATABASE_CONFIG = {
  // Connection pool settings
  CONNECTION_POOL: {
    MAX_CONNECTIONS: 10,
    IDLE_TIMEOUT_SECONDS: 20,
    CONNECT_TIMEOUT_SECONDS: 10,
  },
  
  // Query settings
  QUERY_TIMEOUT_SECONDS: 30,
  
  // Migration settings
  MIGRATION_BATCH_SIZE: 1000,
  
  // Index settings
  DEFAULT_INDEX_TYPE: 'btree',
  
  // Performance settings
  STATEMENT_TIMEOUT_SECONDS: 60,
  LOCK_TIMEOUT_SECONDS: 30,
} as const;
