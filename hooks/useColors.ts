/**
 * useColors — dark/light-mode-aware color hook for CulturePassAU.
 *
 * Returns the correct color theme based on the device's color scheme setting.
 * This is the preferred way to access colors in components so they respond
 * correctly to system dark mode.
 *
 * Usage:
 *   const colors = useColors();
 *   <View style={{ backgroundColor: colors.background }} />
 *   <Text style={{ color: colors.text }} />
 *
 * For static use (e.g. in StyleSheet.create at module level where hooks
 * cannot be called), import Colors directly:
 *   import Colors from '@/constants/colors';
 *   // Colors maps to the light theme by default
 */

import { useColorScheme } from 'react-native';
import type { ColorTheme } from '@/constants/colors';
import { light, dark } from '@/constants/colors';

export function useColors(): ColorTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

// ---------------------------------------------------------------------------
// Selector variant — access a single token without re-rendering on
// unrelated color changes (useful for components that only use one color).
//
// Usage:
//   const primary = useColor('primary');
// ---------------------------------------------------------------------------
export function useColor<K extends keyof ColorTheme>(key: K): ColorTheme[K] {
  const colors = useColors();
  return colors[key];
}
