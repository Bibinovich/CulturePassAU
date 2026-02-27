import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiUrl, apiRequest } from '@/lib/query-client';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { User, Membership, Wallet, EventData } from '@shared/schema';
import { useOnboarding } from '@/contexts/OnboardingContext';

/**
 * CulturePassAU Sydney Query Hooks v2.0
 * Kerala diaspora + Sydney networking optimized
 */

export function useCurrentUser() {
  const { data: usersData, isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/me');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
  
  const user = usersData?.[0] ?? null;
  return { 
    user, 
    userId: user?.id ?? null, 
    isLoading, 
    error, 
    refetch 
  };
}

export function useSydneyUser() {
  const currentUser = useCurrentUser();
  const { user } = currentUser;
  const { state } = useOnboarding();

  const isSydneyUser = state.city?.toLowerCase().includes('sydney') ?? false;

  return {
    ...currentUser,
    isSydneyNative: user?.city?.toLowerCase().includes('sydney') ?? false,
    isSydneyUser,
    showSydneyWelcome: !state.isComplete && isSydneyUser,
  };
}

export function useMembership(userId: string | null) {
  return useQuery<Membership>({
    queryKey: ['membership', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const base = getApiUrl();
      const res = await fetch(`${base}api/membership/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch membership');
      return res.json();
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useWallet(userId: string | null) {
  return useQuery<Wallet>({
    queryKey: ['wallet', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const base = getApiUrl();
      const res = await fetch(`${base}api/wallet/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useTicketCount(userId: string | null) {
  return useQuery<{ count: number }>({
    queryKey: ['ticketCount', userId],
    queryFn: async () => {
      if (!userId) return { count: 0 };
      const base = getApiUrl();
      const res = await fetch(`${base}api/tickets/${userId}/count`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUnreadNotifications(userId: string | null) {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return { count: 0 };
      const base = getApiUrl();
      const res = await fetch(`${base}api/notifications/${userId}/unread-count`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 30 * 1000, // 30 seconds
  });
}

// Sydney-optimized profile completeness
export function useProfileCompleteness(user: User | null) {
  if (!user) return 0;
  
  const checks = {
    displayName: !!user.displayName,
    bio: !!user.bio,
    avatarUrl: !!user.avatarUrl,
    location: !!(user.city || user.country || user.location),
    username: !!user.username,
    socialLinks: !!(user.socialLinks && Object.keys(user.socialLinks).length > 0),
    interests: !!(user.interests && user.interests.length > 0),
    sydneyLocal: user.city?.toLowerCase().includes('sydney'),
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  return Math.min(score / Object.keys(checks).length * 100, 100);
}

export function useSydneyProfileCompleteness(user: User | null) {
  const baseScore = useProfileCompleteness(user);
  const sydneyBonus = user?.city?.toLowerCase().includes('sydney') ? 15 : 0;
  return Math.min(baseScore + sydneyBonus, 100);
}

// CPID lookup with Sydney optimization
export function useCpidLookup(cpid: string | null) {
  return useQuery({
    queryKey: ['cpidLookup', cpid],
    queryFn: async () => {
      if (!cpid) return null;
      
      const base = getApiUrl();
      const res = await fetch(`${base}api/cpid/lookup/${encodeURIComponent(cpid)}`);
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('CPID lookup failed');
      }
      
      const data = await res.json();
      
      // Sydney optimization - auto-fetch profile for users
      if (data.entityType === 'user' && data.targetId) {
        const profileRes = await fetch(`${base}api/users/${data.targetId}`);
        if (profileRes.ok) {
          data.profile = await profileRes.json();
        }
      }
      
      return data;
    },
    enabled: !!cpid && cpid.length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error.message.includes('404')) return false;
      return failureCount < 3;
    },
  });
}

// Sydney events recommendations
export function useSydneyEventRecommendations(userId: string | null) {
  return useQuery<EventData[]>({
    queryKey: ['sydneyRecommendations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const base = getApiUrl();
      const res = await fetch(`${base}api/recommendations/sydney/${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
    enabled: !!userId,
  });
}

// Mutations with haptic feedback
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ eventId, favorite }: { eventId: string; favorite: boolean }) => {
      const res = await apiRequest('POST', `/api/events/${eventId}/favorite`, { favorite });
      return res.json();
    },
    onMutate: async ({ eventId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['currentUser'] });
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(
          favorite 
            ? Haptics.ImpactFeedbackStyle.Medium 
            : Haptics.ImpactFeedbackStyle.Light
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useSydneyFavorites() {
  const { userId } = useCurrentUser();
  return useSydneyEventRecommendations(userId);
}

// All hooks above are already exported via their declarations.
