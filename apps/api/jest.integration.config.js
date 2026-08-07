/**
 * Integration test configuration (@courier/api) — fixes the previously dead
 * `test:integration` script (task 1.14).
 * Runs tests/integration/** against a real MongoDB test database (see
 * tests/integration/client-code.http.test.js). Longer timeout: the
 * concurrency scenario fans out 25 parallel HTTP requests.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  testTimeout: 60000,
};
