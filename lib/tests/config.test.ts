import assert from 'node:assert/strict';
import { getMissingFirebaseEnvKeys } from '../config';

// Define the type and required keys locally for assertions based on config.ts
type RequiredFirebaseEnvKey =
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID';

const REQUIRED_KEYS: RequiredFirebaseEnvKey[] = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Helper to clear environment variables between tests
function clearFirebaseEnv() {
  for (const key of REQUIRED_KEYS) {
    delete process.env[key];
  }
}

// Store original env
const originalEnv = { ...process.env };

try {
  // Test 1: All keys are missing
  clearFirebaseEnv();
  assert.deepEqual(getMissingFirebaseEnvKeys(), REQUIRED_KEYS, 'Should return all keys when none are set');

  // Test 2: All keys are present
  clearFirebaseEnv();
  for (const key of REQUIRED_KEYS) {
    process.env[key] = 'test-value';
  }
  assert.deepEqual(getMissingFirebaseEnvKeys(), [], 'Should return empty array when all keys are set');

  // Test 3: Some keys are present, some are missing
  clearFirebaseEnv();
  process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] = 'test-key';
  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] = 'test-project';

  const expectedMissing: RequiredFirebaseEnvKey[] = [
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
  ];
  assert.deepEqual(getMissingFirebaseEnvKeys(), expectedMissing, 'Should return only missing keys');

  // Test 4: Keys with empty strings or whitespace are considered missing
  clearFirebaseEnv();
  for (const key of REQUIRED_KEYS) {
    process.env[key] = 'test-value'; // Set all initially
  }
  process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] = ''; // Empty string
  process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] = '   '; // Whitespace

  const expectedMissingWhitespace: RequiredFirebaseEnvKey[] = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  ];
  assert.deepEqual(getMissingFirebaseEnvKeys(), expectedMissingWhitespace, 'Should treat empty or whitespace strings as missing');

  console.log('lib/config checks passed');

} finally {
  // Restore original env
  process.env = { ...originalEnv };
}
