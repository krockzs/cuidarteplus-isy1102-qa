module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/T-*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/helpers/setup.js'],
  testTimeout: 18000,
  maxWorkers: 1,
  clearMocks: true,
  verbose: true
};
