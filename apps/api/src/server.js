require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const loaders = require('./loaders');
const logger = require('./logs/logger');
const config = require('./config');
const connectionManager = require('./services/tenant/connectionManager');

async function start() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  // Initialize loaders
  await loaders.init({ app, io });

  // Global error handler MUST be last
  app.use(require('./middlewares/errorHandler'));

  httpServer.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.env}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    await connectionManager.closeAll();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});