const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/config');
const logger = require('./utils/logger');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env,
    service: 'payments-notifications-service',
  };
  
  logger.info('Health check requested', healthStatus);
  res.status(200).json(healthStatus);
});

// API Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { path: req.path, method: req.method });
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(config.server.env === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, {
    environment: config.server.env,
    port: PORT,
  });
});

module.exports = app;

