import { makeWorkerUtils, WorkerUtils } from 'graphile-worker';

// Job payload type
export interface BotProcessingJob {
  messageId: string;
  conversationId: string;
  userId: string;
  manuscriptId?: string;
}

// Lazy initialization of worker utils
let workerUtils: WorkerUtils | null = null;

async function getWorkerUtils(): Promise<WorkerUtils> {
  if (workerUtils) return workerUtils;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Initializing graphile-worker utils...');
  workerUtils = await makeWorkerUtils({
    connectionString,
  });

  console.log('✅ graphile-worker utils initialized');
  return workerUtils;
}

// Add a job to the queue
export async function addBotJob(payload: BotProcessingJob): Promise<void> {
  const utils = await getWorkerUtils();
  await utils.addJob('bot-processing', payload, {
    maxAttempts: 3,
  });
  console.log(`Bot job queued for message ${payload.messageId}`);
}

// Queue health check
export async function getQueueHealth() {
  try {
    const utils = await getWorkerUtils();
    // graphile-worker doesn't have built-in health methods,
    // but we can check if the connection works
    return {
      status: 'healthy',
      message: 'graphile-worker connected',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  console.log('Closing graphile-worker utils...');
  if (workerUtils) {
    await workerUtils.release();
    workerUtils = null;
  }
  console.log('graphile-worker utils closed');
}

export default { addBotJob, getQueueHealth, closeQueues };
