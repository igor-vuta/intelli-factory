import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  clearMocks: true,
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
});
