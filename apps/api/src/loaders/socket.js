const jwt = require('jsonwebtoken');
const logger = require('../logs/logger');
const config = require('../config');
const socketState = require('../services/socketState');

function init({ io, app }) {
  // Store io instance for use in routes
  app.set('io', io);

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.sub;
      socket.tenant = decoded.tenant;
      socket.role = decoded.role;
      socket.clientId = decoded.clientId;
      socket.branchId = decoded.branchId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Join user room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join branch room
    if (socket.branchId) {
      socket.join(`branch:${socket.branchId}`);
    }

    // Join tenant room (staff only — client sockets must not receive
    // tenant-wide payloads containing other customers' package data)
    if (socket.tenant && !socket.clientId) {
      socket.join(`tenant:${socket.tenant}`);
    }

    // Join customer room (for client users receiving package events)
    if (socket.clientId) {
      socket.join(`customer:${socket.clientId}`);
    }

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  // Store for event handlers
  socketState.setIO(io);

  logger.info('Socket.io initialized');
}

module.exports = { init };