import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import articlesRoutes from './routes/articles';
import conversationsRoutes from './routes/conversations';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import botsRoutes from './routes/bots';
import botManagementRoutes from './routes/bot-management';
import botConfigFilesRoutes from './routes/bot-config-files';
import contentRoutes from './routes/content';
import eventsRoutes, { closeAllConnections } from './routes/events';
import orcidRoutes from './routes/orcid';
import reviewersRoutes from './routes/reviewers';
import formatsRoutes from './routes/formats';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { initializeBots } from './bots';
import { startBotWorker, stopBotWorker, startQueueMonitoring, stopQueueMonitoring } from './jobs/worker';
import { closeQueues, getQueueHealth } from './jobs';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'", "http://localhost:3000", "http://127.0.0.1:3000"]
    }
  }
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001', // Allow both ports for development
    'http://127.0.0.1:3000',  // Also allow 127.0.0.1 for local development
    'http://127.0.0.1:3001'   // And the alternate port
  ],
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 15 // 15 minutes
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve published assets statically (no authentication required)
app.use('/static/published', express.static(path.join(process.cwd(), 'static', 'published'), {
  maxAge: '1y', // Long cache for published content (immutable)
  immutable: true,
  setHeaders: (res, filePath) => {
    // Set inline disposition for images to enable embedding
    if (filePath.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
      res.setHeader('Content-Disposition', 'inline');
    }
    // Set CORS headers for cross-origin access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

// Health check
app.get('/health', async (req, res) => {
  try {
    let queueHealth;
    try {
      queueHealth = await getQueueHealth();
    } catch (queueError) {
      console.warn('Queue health check failed:', queueError);
      queueHealth = { status: 'error', error: 'Queue health check failed' };
    }
    
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'colloquium-api',
      version: process.env.npm_package_version || '0.1.0',
      queue: queueHealth
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString(),
      service: 'colloquium-api',
      version: process.env.npm_package_version || '0.1.0',
      error: 'Health check failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/bot-management', botManagementRoutes);
app.use('/api/bot-config-files', botConfigFilesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/orcid', orcidRoutes);
app.use('/api/reviewers', reviewersRoutes);
app.use('/api/formats', formatsRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);


// Create an HTTP server from the Express app to manage connections
const server = http.createServer(app);

// Start server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Colloquium API - Academic Journal Platform`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    
    // Initialize bots after server starts
    try {
      console.log('🤖 Initializing bots...');
      await initializeBots();
      console.log('✅ Bot initialization complete');
    } catch (error) {
      console.error('❌ Bot initialization failed:', error);
    }
    
    // Start bot processing worker
    try {
      console.log('⚙️ Starting bot processing worker...');
      startBotWorker();
      startQueueMonitoring();
      console.log('✅ Bot worker started successfully');
    } catch (error) {
      console.error('❌ Bot worker initialization failed:', error);
    }
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Another instance may still be shutting down.`);
      console.error(`💡 Try: pkill -f "tsx.*app.ts" && npm run dev`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });
}

// Graceful shutdown logic
const gracefulShutdown = async () => {
  console.log('\nSIGINT received. Starting graceful shutdown.');
  
  // 1. Close all active SSE connections
  closeAllConnections();

  // 2. Stop bot processing worker and close queues
  try {
    console.log('Stopping bot worker...');
    stopQueueMonitoring();
    await stopBotWorker();
    console.log('Closing job queues...');
    await closeQueues();
    console.log('✅ Bot worker and queues closed successfully');
  } catch (error) {
    console.error('❌ Error closing bot worker/queues:', error);
  }

  // 3. Close the HTTP server with timeout
  const shutdownTimeout = setTimeout(() => {
    console.log('Force shutdown after timeout.');
    process.exit(1);
  }, 10000); // 10 second timeout to allow for queue cleanup

  server.close(() => {
    clearTimeout(shutdownTimeout);
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

// Listen for termination signals (e.g., Ctrl+C)
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;