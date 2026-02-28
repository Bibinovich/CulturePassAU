import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';

// Use a global mock state so we can alter returns between tests
const mockState = {
  useQueryData: { data: [{ id: 'user-1' }], isLoading: false, error: null } as any
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === '@tanstack/react-query') {
        return {
            useQuery: () => {
                const res = typeof mockState.useQueryData === 'function' ? mockState.useQueryData() : mockState.useQueryData;
                return { ...res, refetch: () => {} };
            },
            useMutation: () => ({}),
            useQueryClient: () => ({})
        };
    }
    if (id === 'react-native') {
        return { Platform: { OS: 'web' } };
    }
    if (id === 'expo-haptics') {
        return { impactAsync: () => {}, ImpactFeedbackStyle: {} };
    }
    if (id === '@/lib/query-client') {
        return { getApiUrl: () => '', apiRequest: () => ({}) };
    }
    if (id === '@/contexts/OnboardingContext') {
        return { useOnboarding: () => ({ state: { isComplete: true, city: 'sydney' } }) };
    }
    return originalRequire.apply(this, arguments as any);
};

const { useCurrentUser } = require('../../hooks/useProfile');

test('useCurrentUser returns user data correctly', () => {
  mockState.useQueryData = { data: [{ id: 'user-123', name: 'Test' }], isLoading: false, error: null };
  const res = useCurrentUser();
  assert.equal(res.userId, 'user-123');
  assert.equal(res.user.name, 'Test');
  assert.equal(res.isLoading, false);
  assert.equal(res.error, null);
});

test('useCurrentUser handles empty users array', () => {
  mockState.useQueryData = { data: [], isLoading: false, error: null };
  const res = useCurrentUser();
  assert.equal(res.userId, null);
  assert.equal(res.user, null);
});

test('useCurrentUser handles undefined data (loading state)', () => {
  mockState.useQueryData = { data: undefined, isLoading: true, error: null };
  const res = useCurrentUser();
  assert.equal(res.userId, null);
  assert.equal(res.user, null);
  assert.equal(res.isLoading, true);
});

test('useCurrentUser handles error state', () => {
  mockState.useQueryData = { data: undefined, isLoading: false, error: new Error('Failed to fetch') };
  const res = useCurrentUser();
  assert.equal(res.userId, null);
  assert.ok(res.error instanceof Error);
  assert.equal(res.error.message, 'Failed to fetch');
});
