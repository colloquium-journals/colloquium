import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import manuscriptsRoutes from './routes/manuscripts';
import conversationsRoutes from './routes/conversations';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import botsRoutes from './routes/bots';
import contentRoutes from './routes/content';
import eventsRoutes from './routes/events';
import orcidRoutes from './routes/orcid';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Import bot system
import { initializeBots } from './bots';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001' // Allow both ports for development
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
app.use('/api/content', contentRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/orcid', orcidRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize bot system
initializeBots().catch(console.error);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Colloquium API - Academic Journal Platform`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

export default app;