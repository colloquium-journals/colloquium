import { makeWorkerUtils, WorkerUtils } from 'graphile-worker';

// Job payload types
export interface BotProcessingJob {
  messageId: string;
  conversationId: string;
  userId: string;
  manuscriptId?: string;
}

export interface DeadlineReminderJob {
  reminderId: string;
  assignmentId: string;
  daysBefore: number;
}

export interface BotEventJob {
  eventName: string;
  botId: string;
  manuscriptId: string;
  payload: Record<string, unknown>;
}

export interface DeadlineScannerJob {
  triggeredAt: string;
}

export interface PipelineStepJob {
  manuscriptId: string;
  steps: Array<{ bot: string; command: string; parameters?: Record<string, unknown> }>;
  stepIndex: number;
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

// Schedule a deadline reminder job
export async function scheduleReminderJob(
  payload: DeadlineReminderJob,
  runAt: Date,
  jobKey: string
): Promise<void> {
  const utils = await getWorkerUtils();
  await utils.addJob('deadline-reminder', payload, {
    runAt,
    jobKey,
    maxAttempts: 3,
  });
  console.log(`Deadline reminder job scheduled for ${runAt.toISOString()} (key: ${jobKey})`);
}

// Trigger the deadline scanner manually (for testing or manual runs)
export async function triggerDeadlineScanner(): Promise<void> {
  const utils = await getWorkerUtils();
  await utils.addJob('deadline-scanner', { triggeredAt: new Date().toISOString() }, {
    maxAttempts: 1,
  });
  console.log('Deadline scanner job triggered manually');
}

// Add a bot event job to the queue
export async function addBotEventJob(payload: BotEventJob): Promise<void> {
  const utils = await getWorkerUtils();
  await utils.addJob('bot-event-processing', payload, {
    maxAttempts: 3,
  });
}

// Add a pipeline step job to the queue
export async function addPipelineStepJob(payload: PipelineStepJob): Promise<void> {
  const utils = await getWorkerUtils();
  await utils.addJob('bot-pipeline-step', payload, {
    maxAttempts: 1,
  });
}

// Export getWorkerUtils for external use
export { getWorkerUtils };

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

export default { addBotJob, addBotEventJob, addPipelineStepJob, getQueueHealth, closeQueues };
