import { PrismaClient } from '@prisma/client';

// Extend PrismaClient with custom methods if needed
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Export types from Prisma client
export * from '@prisma/client';

// Re-export shared types from @colloquium/types
export * from '@colloquium/types';

// Custom database utilities
export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
}

// Graceful shutdown
process.on('beforeExit', () => {
  disconnectDatabase();
});

process.on('SIGINT', () => {
  disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  disconnectDatabase();
  process.exit(0);
});