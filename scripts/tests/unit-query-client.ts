import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

// Override require to intercept react-native and expo modules
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  if (request === 'expo/fetch') {
    return { fetch: async () => ({ ok: true, json: async () => ({}) }) };
  }
  if (request === '@tanstack/react-query') {
    return { QueryClient: class {}, QueryFunction: {} };
  }
  if (request === 'expo-router') {
    return { router: { replace: () => {} } };
  }
  if (request === 'expo-haptics') {
    return { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light' } };
  }
  if (request === '@/lib/config') {
    return { getExplicitApiUrl: () => null };
  }

  return originalLoad.apply(this, arguments);
};

// Now dynamically import the query client
import('../../lib/query-client.ts').then(({ setAccessToken, getAccessToken }) => {
  console.log('Running unit tests for query-client...');

  // Test 1: Initial state should be null
  setAccessToken(null); // Ensure clean state
  assert.equal(getAccessToken(), null, 'Initial access token should be null');

  // Test 2: Setting a valid token
  const testToken = 'test-token-123';
  setAccessToken(testToken);
  assert.equal(getAccessToken(), testToken, 'Access token should match the set value');

  // Test 3: Resetting to null
  setAccessToken(null);
  assert.equal(getAccessToken(), null, 'Access token should be null after reset');

  // Test 4: Setting a different token
  const anotherToken = 'another-token-456';
  setAccessToken(anotherToken);
  assert.equal(getAccessToken(), anotherToken, 'Access token should match the newly set value');

  // Clean up
  setAccessToken(null);

  console.log('unit query-client checks passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
