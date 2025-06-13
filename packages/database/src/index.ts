import { PrismaClient } from '@prisma/client';

// Extend PrismaClient with custom methods if needed
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Export types from Prisma client (this includes the generated enums and models)
export * from '@prisma/client';

// Re-export only specific types from @colloquium/types that don't conflict
export type {
  ApiResponse,
  AuthUser,
  JWTPayload,
  BotContext,
  BotResponse,
  BotAttachment,
  BotAction,
  Bot,
  CreateManuscriptData,
  CreateConversationData,
  CreateMessageData,
  UpdateUserData,
  UpdateJournalSettingsData,
  UpdateBotConfigData,
  LoginData
} from '@colloquium/types';

// Re-export schemas for validation
export {
  loginSchema,
  manuscriptSubmissionSchema,
  conversationSchema,
  messageSchema,
  userUpdateSchema,
  journalSettingsSchema,
  botConfigSchema,
  BotTrigger,
  BotPermission
} from '@colloquium/types';

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