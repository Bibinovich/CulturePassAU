import assert from 'node:assert/strict';
import { getFirebaseWebConfig } from '../config';

const REQUIRED_FIREBASE_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Backup original env vars
const originalEnv = { ...process.env };

function cleanup() {
  // Clear all current keys
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  // Restore original keys
  for (const key of Object.keys(originalEnv)) {
    process.env[key] = originalEnv[key];
  }
}

function testGetFirebaseWebConfigMissingKeys() {
  // Clear all required keys
  for (const key of REQUIRED_FIREBASE_KEYS) {
    delete process.env[key];
  }

  assert.throws(
    () => getFirebaseWebConfig(),
    (err: Error) => err.message.includes('[CulturePass] Missing Firebase environment variables:')
  );

  // Set all but one key
  for (const key of REQUIRED_FIREBASE_KEYS) {
    process.env[key] = `test-${key}`;
  }
  delete process.env['EXPO_PUBLIC_FIREBASE_API_KEY'];

  assert.throws(
    () => getFirebaseWebConfig(),
    (err: Error) => {
      return err.message.includes('EXPO_PUBLIC_FIREBASE_API_KEY') && err.message.includes('[CulturePass] Missing Firebase environment variables:');
    }
  );
}

function testGetFirebaseWebConfigSuccess() {
  // Set all keys
  for (const key of REQUIRED_FIREBASE_KEYS) {
    process.env[key] = `test-${key}`;
  }

  const config = getFirebaseWebConfig();

  assert.deepEqual(config, {
    apiKey: 'test-EXPO_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'test-EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'test-EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'test-EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'test-EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'test-EXPO_PUBLIC_FIREBASE_APP_ID',
  });
}

try {
  testGetFirebaseWebConfigMissingKeys();
  testGetFirebaseWebConfigSuccess();
  console.log('unit config checks passed');
} finally {
  cleanup();
}
