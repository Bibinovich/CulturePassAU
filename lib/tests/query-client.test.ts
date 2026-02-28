import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const originalRequire = Module.prototype.require;

// Mock dependencies required by lib/query-client.ts to run tests without native modules crashing
const mocks: Record<string, any> = {
  'react-native': {
    Platform: {
      get OS() { return (globalThis as any).__mockPlatformOS || 'ios'; }
    }
  },
  'expo/fetch': { fetch: () => {} },
  'expo-router': { router: {} },
  'expo-haptics': { impactAsync: () => {}, ImpactFeedbackStyle: { Light: 0 } },
  '@tanstack/react-query': { QueryClient: class {}, QueryFunction: class {} },
  '@/lib/config': {
    getExplicitApiUrl: () => (globalThis as any).__mockExplicitUrl
  }
};

(Module.prototype as any).require = function (id: string) {
  if (mocks[id]) {
    return mocks[id];
  }
  return originalRequire.apply(this, arguments as any);
};

// Now we can safely import the module
const queryClient = require('../query-client.ts');
const { getApiUrl } = queryClient;

// Setup globals for mocking
const globalThisAny = globalThis as any;
const originalEnv = process.env;

function runTest(name: string, platformOS: string, windowObj: any, explicitUrl: string | undefined, envDomain: string | undefined, expectedUrl: string) {
  process.env = { ...originalEnv }; // reset env

  globalThisAny.__mockPlatformOS = platformOS;
  globalThisAny.__mockExplicitUrl = explicitUrl;

  if (envDomain) {
    process.env.EXPO_PUBLIC_DOMAIN = envDomain;
  } else {
    delete process.env.EXPO_PUBLIC_DOMAIN;
  }

  if (windowObj !== undefined) {
    globalThisAny.window = windowObj;
  } else {
    delete globalThisAny.window;
  }

  try {
    const result = getApiUrl();
    assert.equal(result, expectedUrl);
    console.log(`✅ ${name}`);
  } catch (err: any) {
    console.error(`❌ ${name}`);
    console.error(`   Expected: ${expectedUrl}`);
    console.error(`   Actual:   ${err.actual ?? err.message}`);
    process.exit(1);
  }
}

console.log('--- Testing getApiUrl platform differences ---');

runTest('returns explicit URL if set via EXPO_PUBLIC_API_URL',
  'ios', undefined, 'https://explicit.api.com/', undefined, 'https://explicit.api.com/');

runTest('returns explicit URL normalized',
  'ios', undefined, 'https://explicit.api.com////', undefined, 'https://explicit.api.com/');

runTest('returns localhost for non-web platforms (ios)',
  'ios', undefined, undefined, undefined, 'http://localhost:5050/');

runTest('returns localhost for non-web platforms (android)',
  'android', undefined, undefined, undefined, 'http://localhost:5050/');

runTest('returns localhost for web if not running on replit',
  'web', { location: { host: 'example.com' } }, undefined, undefined, 'http://localhost:5050/');

runTest('returns EXPO_PUBLIC_DOMAIN if running on web and on replit',
  'web', { location: { host: 'myapp.replit.dev' } }, undefined, 'custom-domain.com', 'https://custom-domain.com/');

runTest('returns window location origin for web on replit if EXPO_PUBLIC_DOMAIN is not set',
  'web', { location: { host: 'myapp.replit.dev', origin: 'https://myapp.replit.dev' } }, undefined, undefined, 'https://myapp.replit.dev/');

runTest('returns localhost for web on replit if EXPO_PUBLIC_DOMAIN is not set and window is undefined',
  'web', undefined, undefined, undefined, 'http://localhost:5050/');

console.log('query-client getApiUrl tests passed');

// Restore require and env
(Module.prototype as any).require = originalRequire;
process.env = originalEnv;
