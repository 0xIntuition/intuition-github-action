// See: https://jestjs.io/docs/configuration

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  clearMocks: true,
  collectCoverage: false, // Don't collect coverage for integration tests
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js'],
  preset: 'ts-jest',
  reporters: ['default'],
  resolver: 'ts-jest-resolver',
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.ts'], // Only integration tests
  testPathIgnorePatterns: ['/dist/', '/node_modules/', '__tests__/unit/'],
  testTimeout: 120000, // 2 minutes for blockchain operations
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true
      }
    ]
  },
  verbose: true,
  // Setup file to load .env.local and validate environment
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup/test-env.ts']
}
