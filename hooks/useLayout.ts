/**
 * useLayout — responsive layout hook for CulturePassAU.
 *
 * Returns platform + breakpoint state and pre-computed responsive values
 * so every component gets consistent grid, padding, and column config
 * without ad-hoc `useWindowDimensions()` boilerplate.
 *
 * Usage:
 *   const { isDesktop, numColumns, hPad, tabBarHeight } = useLayout();
 */

import { Platform, useWindowDimensions } from 'react-native';
import { Breakpoints, Layout, TabBarTokens } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutState {
  /** Raw window width from useWindowDimensions */
  width: number;
  /** Raw window height from useWindowDimensions */
  height: number;

  // Platform
  isWeb:     boolean;
  isNative:  boolean;
  isIOS:     boolean;
  isAndroid: boolean;

  // Breakpoints
  isMobile:  boolean;   // < 768px
  isTablet:  boolean;   // 768–1023px
  isDesktop: boolean;   // ≥ 1024px

  // Grid
  /** Recommended column count for event / content grids */
  numColumns: number;
  /** Recommended column count for wider featured/discover grids */
  numColumnsWide: number;

  // Spacing
  /** Horizontal page padding */
  hPad: number;
  /** Vertical section spacing */
  vPad: number;
  /** Gap between grid columns */
  columnGap: number;

  // Navigation
  tabBarHeight: number;

  // Helpers
  /** Width of a single grid column (accounts for outer padding + gaps) */
  columnWidth: (cols?: number) => number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLayout(): LayoutState {
  const { width, height } = useWindowDimensions();

  const isWeb     = Platform.OS === 'web';
  const isNative  = !isWeb;
  const isIOS     = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  const isDesktop = isWeb && width >= Breakpoints.desktop;
  const isTablet  = width >= Breakpoints.tablet && !isDesktop;
  const isMobile  = !isDesktop && !isTablet;

  // Grid columns
  const numColumns     = isDesktop ? 3 : 2;
  const numColumnsWide = isDesktop ? 4 : isTablet ? 3 : 2;

  // Spacing
  const hPad = isDesktop ? 32 : isTablet ? 24 : 16;
  const vPad = isDesktop ? 32 : 24;
  const columnGap = isDesktop ? 16 : 14;

  // Navigation
  const tabBarHeight = isDesktop
    ? TabBarTokens.heightDesktop
    : TabBarTokens.heightMobile;

  // Column width helper
  const columnWidth = (cols = numColumns): number => {
    const totalGaps = (cols - 1) * columnGap;
    const totalPadding = hPad * 2;
    return (width - totalPadding - totalGaps) / cols;
  };

  return {
    width,
    height,
    isWeb,
    isNative,
    isIOS,
    isAndroid,
    isMobile,
    isTablet,
    isDesktop,
    numColumns,
    numColumnsWide,
    hPad,
    vPad,
    columnGap,
    tabBarHeight,
    columnWidth,
  };
}
