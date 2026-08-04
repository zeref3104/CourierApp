/**
 * Unit test configuration (@courier/api).
 * Explicitly scopes `npm test` (jest --coverage) to tests/unit so the
 * real-DB integration suite (tests/integration) never runs inside the
 * unit run — it needs a live MongoDB and has its own script/config.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
};
