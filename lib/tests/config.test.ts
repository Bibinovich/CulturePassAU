import assert from 'node:assert/strict';
import { shouldUseFirebaseEmulators } from '../config';

console.log('Running lib/config.ts tests...');

function testShouldUseFirebaseEmulators() {
  const originalEnv = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;

  try {
    // Test case 1: 'true'
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    assert.equal(shouldUseFirebaseEmulators(), true, "Should return true when env var is 'true'");

    // Test case 2: 'false'
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = 'false';
    assert.equal(shouldUseFirebaseEmulators(), false, "Should return false when env var is 'false'");

    // Test case 3: undefined
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
    assert.equal(shouldUseFirebaseEmulators(), false, "Should return false when env var is undefined");

    // Test case 4: ' true ' (testing trim inside getEnv)
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = ' true ';
    assert.equal(shouldUseFirebaseEmulators(), true, "Should return true when env var has spaces around 'true'");

    // Test case 5: empty string
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = '';
    assert.equal(shouldUseFirebaseEmulators(), false, "Should return false when env var is empty string");

  } finally {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
    }
  }
}

testShouldUseFirebaseEmulators();

console.log('lib/config.ts checks passed');
