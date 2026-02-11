// This file runs as setupFiles (before setupFilesAfterEnv and before any module imports)
// Set default env vars only if not already provided (e.g., by CI)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/colloquium_test';
