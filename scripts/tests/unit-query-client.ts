import assert from 'node:assert/strict';
import { Module } from 'node:module';

// Register loaders before any import so tsx/esbuild doesn't eagerly resolve things
const oldResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (
    request === 'react-native' ||
    request === 'expo/fetch' ||
    request === 'expo-router' ||
    request === 'expo-haptics' ||
    request === '@/lib/config' ||
    request === '@tanstack/react-query'
  ) {
    return request; // Return a fake built-in like string to skip resolving to disk
  }
  return oldResolveFilename.call(this, request, parent, isMain, options);
};

const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function (id: string) {
  if (id === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  if (id === 'expo/fetch') {
    return { fetch: () => {} };
  }
  if (id === 'expo-router') {
    return { router: {} };
  }
  if (id === 'expo-haptics') {
    return { impactAsync: () => {} };
  }
  if (id === '@/lib/config') {
    return { getExplicitApiUrl: () => null };
  }
  if (id === '@tanstack/react-query') {
    return { QueryClient: class {} };
  }
  return originalRequire.apply(this, arguments as any);
};

async function run() {
  // Use dynamic import so our require hook intercepts the module tree resolution
  const { buildApiUrl, getApiUrl } = await import('../../lib/query-client');

  const baseUrl = getApiUrl();

  // Test empty string
  assert.equal(buildApiUrl(''), baseUrl, 'Empty route should just return baseUrl');

  // Test route without leading slash
  assert.equal(buildApiUrl('api/users'), new URL('api/users', baseUrl).toString(), 'Route without leading slash should append to baseUrl correctly');

  // Test route with leading slash
  assert.equal(buildApiUrl('/api/users'), new URL('api/users', baseUrl).toString(), 'Route with leading slash should append to baseUrl correctly, avoiding double slashes');

  // Test deep route without leading slash
  assert.equal(buildApiUrl('api/events/sydney/123'), new URL('api/events/sydney/123', baseUrl).toString(), 'Deep route without leading slash should append to baseUrl correctly');

  // Test deep route with leading slash
  assert.equal(buildApiUrl('/api/events/sydney/123'), new URL('api/events/sydney/123', baseUrl).toString(), 'Deep route with leading slash should append to baseUrl correctly');

  console.log('unit query-client checks passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
