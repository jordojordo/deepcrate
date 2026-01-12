import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import logger from '@server/config/logger';
import { authMiddleware } from '@server/middleware/auth';
import healthRoutes from '@server/routes/api/v1/health';
import queueRoutes from '@server/routes/api/v1/queue';

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

// Serve static files in production
const staticPath = path.join(process.cwd(), 'static');

try {
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    // Fallback to index.html for SPA routing
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        res.sendFile(path.join(staticPath, 'index.html'));
      }
    });
  }
} catch(error) {
  logger.error('Failed to initialize static directory:', error);
  // Static directory doesn't exist, skip
}

export default app;
