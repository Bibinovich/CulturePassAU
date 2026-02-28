import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Since we're using tsx without a dedicated jest-like mock system,
// we intercept require at the module level.
const require = createRequire(import.meta.url);
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(this: any, name: string) {
  if (name === 'react-native') return { Platform: { OS: 'web' } };
  if (name === 'expo/fetch') return { fetch: async () => ({}) };
  if (name === 'expo-router') return { router: { replace: () => {} } };
  if (name === 'expo-haptics') return { impactAsync: async () => {} };
  return originalRequire.apply(this, arguments as any);
};

// Now import the module to test
async function runTests() {
  const { setAccessToken, getAccessToken } = await import('../../lib/query-client');

  console.log('Testing setAccessToken...');

  // Test setting token
  setAccessToken('test-token-123');
  assert.equal(getAccessToken(), 'test-token-123', 'Access token should be set');

  // Test clearing token
  setAccessToken(null);
  assert.equal(getAccessToken(), null, 'Access token should be cleared');

  console.log('setAccessToken tests passed');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
