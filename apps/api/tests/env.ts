// This file runs as setupFiles (before setupFilesAfterEnv and before any module imports)
// Load .env file from project root to get database credentials
import * as path from 'path';
import * as dotenv from 'dotenv';

const envResult = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Override DATABASE_URL to use test database (keep credentials from .env, change DB name)
if (!process.env.DATABASE_URL) {
  // No DATABASE_URL at all - shouldn't happen with .env loaded
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/colloquium_test';
} else if (process.env.DATABASE_URL.includes('colloquium_dev')) {
  // Local dev URL from .env - swap to test database
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('colloquium_dev', 'colloquium_test');
}
// In CI, DATABASE_URL is set to colloquium_test already via passThroughEnv

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
