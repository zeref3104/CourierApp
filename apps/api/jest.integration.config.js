/**
 * Integration test configuration (@courier/api).
 * Referenced by the `test:integration` script (previously dangling — the file
 * did not exist). The integration suite talks to a REAL MongoDB (MONGO_URI
 * from apps/api/.env) and must NOT run inside `npm test`, which is scoped to
 * tests/unit by jest.config.js.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
};
