/**
 * Singleton holder for the Socket.io server instance.
 * Set during loader initialization, consumed by event handlers.
 */
let _io = null;

module.exports = {
  setIO(io) {
    _io = io;
  },
  getIO() {
    return _io;
  },
};
