import Queue from 'bull';
import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  lazyConnect: true,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
};

// Lazy initialization of Redis connections and queue
let redis: Redis | null = null;
let redisSubscriber: Redis | null = null;
let botQueue: Queue.Queue | null = null;

function initializeQueue() {
  if (botQueue) return botQueue;
  
  try {
    console.log('Initializing Redis connections and job queue...');
    
    // Create Redis connections for Bull
    redis = new Redis(redisConfig);
    redisSubscriber = new Redis(redisConfig);
    
    // Wait for Redis to be ready before creating queue
    redis.on('connect', () => {
      console.log('Redis connected for job queue');
    });
    
    redis.on('ready', () => {
      console.log('Redis ready for job queue operations');
    });
    
    redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
    
    // Bot processing queue with simplified Redis configuration
    botQueue = new Queue('bot processing', {
      redis: {
        port: 6379,
        host: 'localhost',
        db: 0,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });

    // Set up event handlers
    botQueue.on('error', (error) => {
      console.error('Bot queue error:', error);
    });

    botQueue.on('waiting', (jobId) => {
      console.log(`Bot job ${jobId} is waiting`);
    });

    botQueue.on('active', (job) => {
      console.log(`Bot job ${job.id} started processing`);
    });

    botQueue.on('completed', (job, result) => {
      console.log(`Bot job ${job.id} completed:`, result);
    });

    botQueue.on('failed', (job, err) => {
      console.error(`Bot job ${job.id} failed:`, err.message);
    });

    botQueue.on('stalled', (job) => {
      console.warn(`Bot job ${job.id} stalled and will be retried`);
    });

    console.log('✅ Redis connections and job queue initialized');
    return botQueue;
  } catch (error) {
    console.error('❌ Failed to initialize job queue:', error);
    throw error;
  }
}

// Export a getter function instead of direct export
export const getBotQueue = () => {
  if (!botQueue) {
    return initializeQueue();
  }
  return botQueue;
};

// Job types
export interface BotProcessingJob {
  messageId: string;
  conversationId: string;
  userId: string;
  manuscriptId?: string;
}

// Queue health check
export const getQueueHealth = async () => {
  try {
    if (!botQueue) {
      return {
        status: 'not_initialized',
        message: 'Queue not yet initialized'
      };
    }
    
    const waiting = await botQueue.getWaiting();
    const active = await botQueue.getActive();
    const completed = await botQueue.getCompleted();
    const failed = await botQueue.getFailed();
    
    return {
      status: 'healthy',
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      redis: redis?.status || 'unknown'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      redis: redis?.status || 'unknown'
    };
  }
};

// Graceful shutdown
export const closeQueues = async () => {
  console.log('Closing job queues...');
  
  if (botQueue) {
    await botQueue.close();
  }
  
  if (redis) {
    await redis.disconnect();
  }
  
  if (redisSubscriber) {
    await redisSubscriber.disconnect();
  }
  
  console.log('Job queues closed');
};

export default getBotQueue;