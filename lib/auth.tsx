import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { setAccessToken } from '@/lib/query-client';
import { router } from 'expo-router';
import { auth as firebaseAuth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { api, ApiError } from '@/lib/api';
import type { UserRole } from '@/shared/schema';

/**
 * CulturePassAU Auth — Firebase Auth SDK
 *
 * Auth state is driven by Firebase's `onAuthStateChanged` observer.
 * On every auth state change:
 *   1. Get fresh Firebase ID token
 *   2. Call GET /api/auth/me (Cloud Function) for full user profile
 *   3. Sync token to query-client's module-level store
 *
 * Token auto-refresh: Firebase SDK refreshes ID tokens silently.
 * We additionally force-refresh every 50 min to keep the query-client store current.
 */

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  role?: UserRole;
  subscriptionTier?: 'free' | 'plus' | 'elite' | 'sydney-local';
  country?: string;
  city?: string;
  avatarUrl?: string;
  isSydneyVerified?: boolean;
  communities?: string[];
  interests?: string[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;  // kept for interface compatibility; Firebase manages refresh internally
  expiresAt: number;
}

interface AuthProfileResponse {
  username?: string;
  displayName?: string;
  email?: string;
  role?: UserRole;
  country?: string;
  city?: string;
  avatarUrl?: string;
  isSydneyVerified?: boolean;
  interests?: string[];
  membership?: {
    tier?: AuthUser['subscriptionTier'];
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isRestoring: boolean;

  // Core auth
  login: (session: AuthSession) => Promise<void>;
  logout: (redirect?: string) => Promise<void>;
  refreshSession: () => Promise<void>;

  // Role helpers
  hasRole: (...roles: UserRole[]) => boolean;

  // Sydney social
  isSydneyUser: boolean;
  isSydneyVerified: boolean;
  showSydneyWelcome: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userId: null,
  user: null,
  accessToken: null,
  isLoading: true,
  isRestoring: false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  hasRole: () => false,
  isSydneyUser: false,
  isSydneyVerified: false,
  showSydneyWelcome: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const onboarding = useOnboarding();

  // ------------------------------------------------------------------
  // Firebase Auth state observer
  // Fires on: initial load (restores persisted session), sign-in, sign-out
  // ------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        setSession(null);
        setAccessToken(null);
        setIsRestoring(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        // Sync token to query-client so apiRequest() includes Authorization header
        setAccessToken(idToken);

        let userProfile: Partial<AuthUser> = {};
        try {
          // Fetch full user profile from Cloud Functions
          const profileData = await api.auth.me() as unknown as AuthProfileResponse;
          const membership = profileData.membership;
          userProfile = {
            username: profileData.username,
            displayName: profileData.displayName,
            email: profileData.email,
            role: profileData.role,
            subscriptionTier: membership?.tier ?? 'free',
            country: profileData.country,
            city: profileData.city,
            avatarUrl: profileData.avatarUrl,
            isSydneyVerified: profileData.isSydneyVerified,
            interests: profileData.interests,
          };
        } catch (error) {
          if (!(error instanceof ApiError)) {
            console.error('[auth] profile fetch error:', error);
          }
        }

        const authUser: AuthUser = {
          id: firebaseUser.uid,
          username: userProfile.username ?? firebaseUser.email?.split('@')[0] ?? firebaseUser.uid,
          displayName: userProfile.displayName ?? firebaseUser.displayName ?? undefined,
          email: userProfile.email ?? firebaseUser.email ?? undefined,
          role: userProfile.role ?? 'user',
          subscriptionTier: userProfile.subscriptionTier ?? 'free',
          country: userProfile.country,
          city: userProfile.city,
          avatarUrl: userProfile.avatarUrl ?? (firebaseUser.photoURL ?? undefined),
          isSydneyVerified: userProfile.isSydneyVerified ?? false,
          interests: userProfile.interests ?? [],
        };

        setSession({
          user: authUser,
          accessToken: idToken,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });

        // Auto-complete onboarding for returning Sydney users
        if (authUser.city?.toLowerCase().includes('sydney')) {
          onboarding.setCity('Sydney');
          onboarding.setCountry('Australia');
        }
      } catch (error) {
        console.error('[auth] onAuthStateChanged error:', error);
        setSession(null);
        setAccessToken(null);
      } finally {
        setIsRestoring(false);
      }
    });

    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Keep query-client token store in sync with Firebase's auto-refresh
  // Firebase refreshes ID tokens silently — we force a sync every 50 min
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const freshToken = await user.getIdToken(true);
          setAccessToken(freshToken);
          setSession((prev) => prev ? { ...prev, accessToken: freshToken } : prev);
        }
      } catch {
        // Firebase will sign out via onAuthStateChanged if token is truly invalid
      }
    }, 50 * 60 * 1000); // 50 min

    return () => clearInterval(interval);
  }, [!!session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // login() — kept for compatibility; screens can call it with a known session
  // ------------------------------------------------------------------
  const login = useCallback(async (newSession: AuthSession) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsLoading(true);
    try {
      setSession(newSession);
      setAccessToken(newSession.accessToken);

      if (newSession.user.city?.toLowerCase().includes('sydney')) {
        onboarding.setCity('Sydney');
        onboarding.setCountry('Australia');
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error('[auth] login:', error);
      Alert.alert('Login Failed', 'Please try again');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onboarding]);

  // ------------------------------------------------------------------
  // logout() — signs out of Firebase; onAuthStateChanged clears session
  // ------------------------------------------------------------------
  const logout = useCallback(async (redirectTo = '/(onboarding)/login') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setIsLoading(true);
    try {
      await signOut(firebaseAuth);
      // onAuthStateChanged will fire with null and clear session + token
      await onboarding.resetOnboarding();
      router.replace(redirectTo as any);
    } catch (error) {
      console.error('[auth] logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onboarding]);

  // ------------------------------------------------------------------
  // refreshSession() — force a fresh ID token
  // ------------------------------------------------------------------
  const refreshSession = useCallback(async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('No authenticated user');
      const freshToken = await user.getIdToken(true);
      setAccessToken(freshToken);
      setSession((prev) => prev ? { ...prev, accessToken: freshToken } : prev);
    } catch (error) {
      console.error('[auth] refreshSession:', error);
      await logout('/(onboarding)/login');
      throw error;
    }
  }, [logout]);

  const isSydneyUser = !!session?.user.city?.toLowerCase().includes('sydney');
  const isSydneyVerified = !!session?.user.isSydneyVerified;

  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    if (!session) return false;
    return roles.includes(session.user.role ?? 'user');
  }, [session]);

  const value = useMemo(() => ({
    isAuthenticated: !!session,
    userId: session?.user.id ?? null,
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    isLoading,
    isRestoring,
    login,
    logout,
    refreshSession,
    hasRole,
    isSydneyUser,
    isSydneyVerified,
    showSydneyWelcome: !onboarding.state.isComplete && isSydneyUser,
  }), [
    session, isLoading, isRestoring, login, logout, refreshSession,
    hasRole, isSydneyUser, isSydneyVerified, onboarding.state.isComplete,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Sydney-specific auth hook — adds locality helpers on top of base auth
export function useSydneyAuth() {
  const baseAuth = useAuth();
  const onboarding = useOnboarding();
  return {
    ...baseAuth,
    isSydneyNative: baseAuth.user?.city?.toLowerCase().includes('sydney') ?? false,
    isOnboardingComplete: onboarding.state.isComplete,
  };
}

/**
 * useAutoRefresh — no-op in Firebase mode.
 * Firebase SDK handles token refresh automatically.
 * Kept for backward compatibility with any callers.
 */
export function useAutoRefresh() {
  // Firebase ID tokens are refreshed silently by the SDK.
}
