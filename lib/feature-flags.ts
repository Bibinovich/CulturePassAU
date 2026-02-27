import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/query-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * CulturePassAU Sydney Feature Flags v2.0
 * Sydney-first rollout + Kerala diaspora beta
 */

export type RolloutPhase = 'internal' | 'pilot' | 'sydney-beta' | 'kerala-diaspora' | 'half' | 'full';

export interface FeatureFlagsResponse {
  rollout: {
    phase: RolloutPhase;
    percentage: number;
    sydneyPercentage?: number;
    keralaPercentage?: number;
  };
  flags: Record<string, boolean>;
  experiments: Record<string, { variant: string; weight: number }>;
  userSegment: 'guest' | 'sydney-local' | 'kerala-diaspora' | 'international';
}

const FLAGS_CACHE_KEY = '@culturepass_flags_cache';
const FLAGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DEFAULT_FLAGS: FeatureFlagsResponse = {
  rollout: { phase: 'pilot', percentage: 10 },
  flags: {},
  experiments: {},
  userSegment: 'guest',
};

export async function fetchFeatureFlags(
  userId: string = 'guest',
  overrideSegment?: string
): Promise<FeatureFlagsResponse> {
  const base = getApiUrl();
  const url = new URL(`${base}api/rollout/flags`);
  url.searchParams.append('userId', userId);
  if (overrideSegment) url.searchParams.append('segment', overrideSegment);

  const res = await fetch(url.toString(), {
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!res.ok) {
    console.warn(`Flags fetch failed (${res.status})`);
    return DEFAULT_FLAGS;
  }

  return res.json();
}

export async function fetchFeatureFlagsCached(userId: string = 'guest'): Promise<FeatureFlagsResponse> {
  try {
    const cached = await AsyncStorage.getItem(FLAGS_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached) as { data: FeatureFlagsResponse; timestamp: number };
      if (Date.now() - timestamp < FLAGS_CACHE_TTL) return data;
    }

    const flags = await fetchFeatureFlags(userId);
    await AsyncStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify({ data: flags, timestamp: Date.now() }));
    return flags;
  } catch (error) {
    console.error('Cached flags fetch failed:', error);
    return DEFAULT_FLAGS;
  }
}

export function useFeatureFlags() {
  const { userId } = useAuth();

  return useQuery<FeatureFlagsResponse>({
    queryKey: ['featureFlags', userId],
    queryFn: () => fetchFeatureFlagsCached(userId ?? 'guest'),
    staleTime: FLAGS_CACHE_TTL,
    refetchOnWindowFocus: false,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
    placeholderData: DEFAULT_FLAGS,
  });
}

export function useSydneyFeatureFlags() {
  const { user } = useAuth();
  const flags = useFeatureFlags();
  const isSydneyUser = user?.city?.toLowerCase().includes('sydney') ?? false;

  return useMemo(() => ({
    ...flags,
    isSydneyBeta: flags.data?.flags['sydney-beta'] ?? isSydneyUser,
    sydneyWallet: flags.data?.flags['wallet-v2'] ?? true,
    sydneyMap: flags.data?.flags['native-maps'] ?? true,
    eventTiers: flags.data?.flags['tiered-pricing'] ?? true,
    keralaPriority: flags.data?.flags['kerala-events'] ?? true,
  }), [flags, isSydneyUser]);
}

export function useFlagOverride(flag: string) {
  const queryClient = useQueryClient();

  return {
    value: useFeatureFlags().data?.flags[flag] ?? false,
    override: (value: boolean) => {
      queryClient.setQueryData<FeatureFlagsResponse>(['featureFlags'], (old) => ({
        ...(old ?? DEFAULT_FLAGS),
        flags: { ...(old?.flags ?? {}), [flag]: value },
      }));

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
  };
}

export function useSydneyRollout() {
  const flags = useFeatureFlags();
  const rollout = flags.data?.rollout;

  return {
    phase: rollout?.phase ?? 'pilot',
    isSydneyBeta: rollout?.phase === 'sydney-beta',
    percentage: rollout?.sydneyPercentage ?? 0,
    segment: flags.data?.userSegment ?? 'guest',
  };
}
