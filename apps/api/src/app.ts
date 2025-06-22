import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import http from 'http';

// Import routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import manuscriptsRoutes from './routes/manuscripts';
import conversationsRoutes from './routes/conversations';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import botsRoutes from './routes/bots';
import botManagementRoutes from './routes/bot-management';
import contentRoutes from './routes/content';
import eventsRoutes, { closeAllConnections } from './routes/events';
import orcidRoutes from './routes/orcid';
import reviewersRoutes from './routes/reviewers';
import checkboxStatesRoutes from './routes/checkbox-states';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { initializeBots } from './bots';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
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

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'colloquium-api',
    version: process.env.npm_package_version || '0.1.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/manuscripts', manuscriptsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/bot-management', botManagementRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/orcid', orcidRoutes);
app.use('/api/reviewers', reviewersRoutes);
app.use('/api/checkbox-states', checkboxStatesRoutes);

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
const gracefulShutdown = () => {
  console.log('\nSIGINT received. Starting graceful shutdown.');
  
  // 1. Close all active SSE connections
  closeAllConnections();

  // 2. Close the HTTP server with timeout
  const shutdownTimeout = setTimeout(() => {
    console.log('Force shutdown after timeout.');
    process.exit(1);
  }, 5000); // 5 second timeout

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