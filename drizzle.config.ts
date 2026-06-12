import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Only load .env.local if DATABASE_URL is not already set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' });
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
