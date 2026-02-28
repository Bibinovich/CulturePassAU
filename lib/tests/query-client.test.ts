import assert from 'node:assert/strict';
import Module from 'node:module';

// We mock require to avoid loading native or expo modules that fail in a pure Node context
// and to allow us to mutate the mock of `Platform.OS`.
let mockPlatformOS = 'web';
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
  if (request === 'react-native') {
    return {
      Platform: {
        get OS() { return mockPlatformOS; }
      }
    };
  }
  if (request === 'expo/fetch') {
    return { fetch: () => {} };
  }
  if (request === '@tanstack/react-query') {
    return { QueryClient: class {}, QueryFunction: {} };
  }
  if (request === 'expo-router') {
    return { router: {} };
  }
  if (request === 'expo-haptics') {
    return { Haptics: {} };
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import the module under test
const { getApiUrl } = require('../query-client');

// Mock helpers
const originalEnv = { ...process.env };
const originalWindow = typeof window !== 'undefined' ? window : undefined;

function resetMocks() {
  process.env = { ...originalEnv };
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_DOMAIN;

  mockPlatformOS = 'web';

  if (typeof global !== 'undefined') {
    delete (global as any).window;
  }
}

try {
  // Scenario 1: explicit API URL (EXPO_PUBLIC_API_URL)
  resetMocks();
  process.env.EXPO_PUBLIC_API_URL = 'https://explicit.api.com';
  assert.equal(getApiUrl(), 'https://explicit.api.com/');

  process.env.EXPO_PUBLIC_API_URL = 'http://trailing-slash.com/';
  assert.equal(getApiUrl(), 'http://trailing-slash.com/');

  // Scenario 2: Native OS (Platform.OS !== 'web')
  resetMocks();
  mockPlatformOS = 'ios';
  assert.equal(getApiUrl(), 'http://localhost:5050/');

  mockPlatformOS = 'android';
  assert.equal(getApiUrl(), 'http://localhost:5050/');

  // Scenario 3: Web not on Replit (window.location.host !== 'replit')
  resetMocks();
  mockPlatformOS = 'web';
  (global as any).window = {
    location: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000'
    }
  };
  assert.equal(getApiUrl(), 'http://localhost:5050/');

  // Scenario 4: Web on Replit with EXPO_PUBLIC_DOMAIN
  resetMocks();
  mockPlatformOS = 'web';
  (global as any).window = {
    location: {
      host: 'my-app.replit.dev',
      origin: 'https://my-app.replit.dev'
    }
  };
  process.env.EXPO_PUBLIC_DOMAIN = 'my-app.replit.app';
  assert.equal(getApiUrl(), 'https://my-app.replit.app/');

  // Scenario 5: Web on Replit without EXPO_PUBLIC_DOMAIN fallback to window.location.origin
  resetMocks();
  mockPlatformOS = 'web';
  (global as any).window = {
    location: {
      host: 'my-app.replit.dev',
      origin: 'https://my-app.replit.dev'
    }
  };
  assert.equal(getApiUrl(), 'https://my-app.replit.dev/');

  // Scenario 6: Fallback if all else fails (e.g. no window, no domain, web OS)
  resetMocks();
  mockPlatformOS = 'web';
  assert.equal(getApiUrl(), 'http://localhost:5050/');

  console.log('query-client getApiUrl checks passed');
} finally {
  // Cleanup
  process.env = originalEnv;
  if (originalWindow !== undefined) {
    (global as any).window = originalWindow;
  } else {
    delete (global as any).window;
  }
}
