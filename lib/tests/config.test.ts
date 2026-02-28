import assert from 'node:assert/strict';
import { getExplicitApiUrl } from '../config';

function runTests() {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  try {
    // Test 1: Standard URL without trailing slash
    process.env.EXPO_PUBLIC_API_URL = 'https://api.culturepass.app/v1';
    assert.equal(
      getExplicitApiUrl(),
      'https://api.culturepass.app/v1/',
      'Should append trailing slash if missing'
    );

    // Test 2: URL with trailing slash
    process.env.EXPO_PUBLIC_API_URL = 'https://api.culturepass.app/v1/';
    assert.equal(
      getExplicitApiUrl(),
      'https://api.culturepass.app/v1/',
      'Should not append extra trailing slash'
    );

    // Test 3: URL with multiple trailing slashes
    process.env.EXPO_PUBLIC_API_URL = 'https://api.culturepass.app/v1///';
    assert.equal(
      getExplicitApiUrl(),
      'https://api.culturepass.app/v1/',
      'Should normalize multiple trailing slashes'
    );

    // Test 4: Env var is undefined
    delete process.env.EXPO_PUBLIC_API_URL;
    assert.equal(
      getExplicitApiUrl(),
      undefined,
      'Should return undefined if env var is not set'
    );

    // Test 5: Env var is empty string
    process.env.EXPO_PUBLIC_API_URL = '';
    assert.equal(
      getExplicitApiUrl(),
      undefined,
      'Should return undefined if env var is empty string'
    );

    // Test 6: Env var is whitespace
    process.env.EXPO_PUBLIC_API_URL = '   ';
    assert.equal(
      getExplicitApiUrl(),
      undefined,
      'Should return undefined if env var is whitespace only'
    );

    console.log('✅ getExplicitApiUrl tests passed');
  } finally {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_API_URL = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
  }
}

runTests();
