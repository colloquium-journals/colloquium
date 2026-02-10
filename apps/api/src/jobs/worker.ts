import { run, Runner, TaskList, parseCronItems } from 'graphile-worker';
import { processBotJob } from './botProcessor';
import { processBotEventJob } from './botEventProcessor';
import { BotProcessingJob, BotEventJob, DeadlineReminderJob } from './index';
import { processDeadlineReminder } from '../services/deadlineReminderProcessor';
import { scanAndScheduleReminders } from '../services/deadlineScanner';

let runner: Runner | null = null;

// Define the task list for graphile-worker
const taskList: TaskList = {
  'bot-processing': async (payload, helpers) => {
    const jobPayload = payload as BotProcessingJob;
    console.log(`🚀 Processing bot job for message ${jobPayload.messageId}`);

    try {
      await processBotJob(jobPayload);
      console.log(`✅ Bot job completed successfully for message ${jobPayload.messageId}`);
    } catch (error) {
      console.error(`❌ Bot job failed for message ${jobPayload.messageId}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  },

  'bot-event-processing': async (payload, helpers) => {
    const jobPayload = payload as BotEventJob;
    console.log(`🔔 Processing bot event ${jobPayload.eventName} for bot ${jobPayload.botId}`);

    try {
      await processBotEventJob(jobPayload);
      console.log(`✅ Bot event job completed for ${jobPayload.botId} (${jobPayload.eventName})`);
    } catch (error) {
      console.error(`❌ Bot event job failed for ${jobPayload.botId} (${jobPayload.eventName}):`, error instanceof Error ? error.message : error);
      throw error;
    }
  },

  'deadline-reminder': async (payload, helpers) => {
    const jobPayload = payload as DeadlineReminderJob;
    console.log(`🔔 Processing deadline reminder for assignment ${jobPayload.assignmentId} (${jobPayload.daysBefore} days before)`);

    try {
      await processDeadlineReminder(jobPayload);
      console.log(`✅ Deadline reminder processed successfully for assignment ${jobPayload.assignmentId}`);
    } catch (error) {
      console.error(`❌ Deadline reminder failed for assignment ${jobPayload.assignmentId}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  },

  'deadline-scanner': async (payload, helpers) => {
    console.log(`🔍 Running deadline scanner at ${new Date().toISOString()}`);

    try {
      await scanAndScheduleReminders();
      console.log(`✅ Deadline scanner completed successfully`);
    } catch (error) {
      console.error(`❌ Deadline scanner failed:`, error instanceof Error ? error.message : error);
      throw error;
    }
  },
};

// Cron schedule for deadline scanner - runs daily at 8 AM
const cronItems = parseCronItems([
  { task: 'deadline-scanner', match: '0 8 * * *', options: { backfillPeriod: 0 } },
]);

// Start the bot processing worker
export const startBotWorker = async () => {
  console.log('Starting graphile-worker bot processing worker...');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  try {
    runner = await run({
      connectionString,
      concurrency: 3,
      noHandleSignals: false,
      pollInterval: 1000,
      taskList,
      parsedCronItems: cronItems,
    });

    console.log('🎉 graphile-worker bot processing is ready! (concurrency: 3)');

    // Handle runner events
    runner.events.on('job:success', ({ job }) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    runner.events.on('job:error', ({ job, error }) => {
      console.error(`Job ${job.id} failed:`, error instanceof Error ? error.message : error);
    });

    return runner;
  } catch (error) {
    console.error('Failed to start graphile-worker:', error);
    throw error;
  }
};

// Graceful shutdown handler
export const stopBotWorker = async () => {
  console.log('Stopping graphile-worker bot processing worker...');
  if (runner) {
    await runner.stop();
    runner = null;
  }
  console.log('graphile-worker bot processing worker stopped');
};

// No polling-based monitoring needed - graphile-worker uses LISTEN/NOTIFY
export const startQueueMonitoring = () => {
  // graphile-worker handles its own monitoring via events
  console.log('Queue monitoring delegated to graphile-worker events');
};

export const stopQueueMonitoring = () => {
  // No-op for graphile-worker
};

export default { startBotWorker, stopBotWorker };
