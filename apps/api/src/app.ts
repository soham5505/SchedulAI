import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiV1Router } from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { isDatabaseConnected } from './config/database.js';
import { schedulerClient } from './utils/schedulerClient.js';
import { sendError, sendSuccess } from './utils/apiResponse.js';
import { ERROR_CODES } from '@schedulai/config';

export const app = express();

// Security & Middlewares
app.use(helmet());
app.use(
  cors({
    origin: '*', // Allow preview domains and local clients
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Top-level Health Check
const healthHandler = async (_req: any, res: any) => {
  const dbStatus = isDatabaseConnected() ? 'connected' : 'disconnected';
  const schedulerAvailable = await schedulerClient.healthCheck();

  const isHealthy = isDatabaseConnected();
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'SchedulAI API Gateway',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    scheduler: schedulerAvailable ? 'available' : 'unavailable',
  });
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// Mount API v1 routes
app.use('/api/v1', apiV1Router);

// 404 Handler
app.use('*', (req, res) => {
  return sendError(
    res,
    `Route ${req.originalUrl} not found`,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    404
  );
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);
