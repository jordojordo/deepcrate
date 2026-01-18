import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import logger from '@server/config/logger';
import { authMiddleware } from '@server/middleware/auth';
import healthRoutes from '@server/routes/api/v1/health';
import queueRoutes from '@server/routes/api/v1/queue';
import jobsRoutes from '@server/routes/api/v1/jobs';
import searchRoutes from '@server/routes/api/v1/search';
import wishlistRoutes from '@server/routes/api/v1/wishlist';
import downloadsRoutes from '@server/routes/api/v1/downloads';
import libraryRoutes from '@server/routes/api/v1/library';

const app = express();

// CORS middleware for development
app.use(
  cors({
    origin:         ['http://localhost:5173'],
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// JSON body parser
app.use(express.json());

// Health check route (no auth required)
app.use('/health', healthRoutes);

// Apply auth middleware to all /api/* routes
app.use('/api', authMiddleware);

// API routes
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/jobs', jobsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/downloads', downloadsRoutes);
app.use('/api/v1/library', libraryRoutes);

// Serve static files in production
const staticPath = path.join(process.cwd(), 'static');

try {
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    // Fallback to index.html for SPA routing
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        res.sendFile(path.join(staticPath, 'index.html'));
      } else {
        next();
      }
    });
  }
} catch(error) {
  logger.error('Failed to initialize static directory:', error);
  // Static directory doesn't exist, skip
}

export default app;
