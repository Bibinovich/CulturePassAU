import assert from 'node:assert/strict';
import { getMissingFirebaseEnvKeys } from '../config';

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Save original env
const originalEnv = { ...process.env };

function runTests() {
  // Test 1: All required keys missing
  REQUIRED_KEYS.forEach(key => delete process.env[key]);
  const allMissing = getMissingFirebaseEnvKeys();
  assert.equal(allMissing.length, REQUIRED_KEYS.length, 'Should return all keys when none are set');
  assert.deepEqual(allMissing, REQUIRED_KEYS, 'Should return exactly the required keys');

  // Test 2: Some required keys missing
  process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] = 'fake-api-key';
  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] = 'fake-project-id';
  const someMissing = getMissingFirebaseEnvKeys();
  assert.equal(someMissing.length, REQUIRED_KEYS.length - 2, 'Should return missing keys when some are set');
  assert.ok(!someMissing.includes('EXPO_PUBLIC_FIREBASE_API_KEY' as any), 'Set keys should not be returned');
  assert.ok(!someMissing.includes('EXPO_PUBLIC_FIREBASE_PROJECT_ID' as any), 'Set keys should not be returned');

  // Test 3: All required keys present
  REQUIRED_KEYS.forEach(key => {
    process.env[key] = `fake-${key}`;
  });
  const noneMissing = getMissingFirebaseEnvKeys();
  assert.equal(noneMissing.length, 0, 'Should return empty array when all keys are set');

  // Test 4: Keys are present but empty (whitespace)
  REQUIRED_KEYS.forEach(key => {
    process.env[key] = '   ';
  });
  const emptyWhitespaceMissing = getMissingFirebaseEnvKeys();
  assert.equal(emptyWhitespaceMissing.length, REQUIRED_KEYS.length, 'Should treat whitespace-only values as missing');

  // Restore original env
  process.env = { ...originalEnv };

  console.log('unit config tests passed');
}

runTests();
