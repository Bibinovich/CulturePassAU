import { type Href, router, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * CulturePassAU Navigation Utilities v2.1
 *
 * All route helpers are plain functions (no hooks inside).
 * Hooks (useSafeBack, useEventNavigation, etc.) are kept for component use.
 */

// ---------------------------------------------------------------------------
// Plain navigation helpers
// ---------------------------------------------------------------------------

export function goBackOrReplace(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

export function goHome() {
  router.replace('/(tabs)');
}

export function navigateToEvent(eventId: string) {
  router.push({ pathname: '/event/[id]', params: { id: eventId } });
}

export function navigateToProfile(identifier: string) {
  if (identifier.startsWith('CP-USER-') || identifier.startsWith('CP-U')) {
    router.push({ pathname: '/contacts/[cpid]', params: { cpid: identifier } });
  } else if (identifier.startsWith('@')) {
    router.push({ pathname: '/user/[id]', params: { id: identifier.slice(1) } });
  } else {
    router.push({ pathname: '/user/[id]', params: { id: identifier } });
  }
}

export function shareEventLink(event: { id: string; title: string }) {
  const url = `culturepass://event/${event.id}`;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    navigator.clipboard?.writeText(url);
  }
  // Native: use expo-sharing when needed
}

// ---------------------------------------------------------------------------
// React hooks (safe to use inside components)
// ---------------------------------------------------------------------------

export function useSafeBack(fallback: Href = '/(tabs)') {
  return useCallback(() => {
    goBackOrReplace(fallback);
  }, [fallback]);
}

export function useEventNavigation() {
  return {
    goToEvent: (eventId: string) => navigateToEvent(eventId),
    goToEventCpid: (cpid: string) => navigateToEvent(cpid.replace('CP-EVT-', '')),
  };
}

export function useProfileNavigation() {
  return {
    goToProfile: (identifier: string) => navigateToProfile(identifier),
  };
}

export function useDeepLinkSafe(href: Href) {
  const pathname = usePathname();
  useLocalSearchParams(); // keep the hook call so it re-renders on param changes

  return useCallback(() => {
    const target = typeof href === 'string' ? href : href.pathname;
    if (pathname === target) return;
    router.push(href);
  }, [href, pathname]);
}
