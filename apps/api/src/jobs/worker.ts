import { getBotQueue } from './index';
import { processBotJob } from './botProcessor';

// Start the bot processing worker
export const startBotWorker = () => {
  console.log('Starting bot processing worker...');
  
  try {
    const botQueue = getBotQueue();
    
    // Process bot jobs with concurrency of 3
    botQueue.process('bot-processing', 3, async (job) => {
      console.log(`🚀 Processing bot job ${job.id} for message ${job.data.messageId}`);
      try {
        const result = await processBotJob(job);
        console.log(`✅ Bot job ${job.id} completed successfully`);
        return result;
      } catch (error) {
        console.error(`❌ Bot job ${job.id} failed:`, error.message);
        throw error;
      }
    });
    
    console.log('Bot processing worker started with concurrency: 3');
    
    console.log('🎉 Async bot processing is ready!');
    
  } catch (error) {
    console.error('Failed to start bot worker:', error);
    throw error;
  }
};

// Graceful shutdown handler
export const stopBotWorker = async () => {
  console.log('Stopping bot processing worker...');
  try {
    const botQueue = getBotQueue();
    await botQueue.close();
  } catch (error) {
    console.warn('Bot queue may not be initialized for shutdown');
  }
  console.log('Bot processing worker stopped');
};

// Worker health monitoring - only start when queue is initialized
let monitoringInterval: NodeJS.Timeout | null = null;

export const startQueueMonitoring = () => {
  if (monitoringInterval) return;
  
  monitoringInterval = setInterval(async () => {
    try {
      const botQueue = getBotQueue();
      const waiting = await botQueue.getWaiting();
      const active = await botQueue.getActive();
      const failed = await botQueue.getFailed();
      
      if (waiting.length > 50) {
        console.warn(`High queue backlog: ${waiting.length} jobs waiting`);
      }
      
      if (failed.length > 10) {
        console.warn(`High failure rate: ${failed.length} failed jobs`);
      }
      
      if (active.length === 0 && waiting.length > 5) {
        console.warn(`High queue backlog with no active workers: ${waiting.length} jobs waiting`);
      }
      
    } catch (error) {
      console.error('Queue monitoring error:', error);
    }
  }, 30000); // Check every 30 seconds
};

export const stopQueueMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
};

export default { startBotWorker, stopBotWorker };