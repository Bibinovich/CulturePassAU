/**
 * Elevation system for CulturePassAU.
 *
 * Each level works on both platforms:
 *  - Native (iOS/Android): React Native shadow props + Android `elevation`
 *  - Web: CSS `box-shadow` via Platform.select (cast to object for TS)
 *
 * Design intent:
 *  level 0  — flat, no shadow (default surface)
 *  level 1  — cards at rest, list items
 *  level 2  — focused cards, active chips
 *  level 3  — floating action areas, sticky bars
 *  level 4  — modals, bottom sheets
 *  level 5  — toasts, popovers
 *
 * Usage:
 *   import { Elevation } from '@/constants/elevation';
 *   <View style={[styles.card, Elevation[2]]} />
 *
 *   // Spread into StyleSheet.create:
 *   const styles = StyleSheet.create({
 *     card: { ...Elevation[1], borderRadius: 16 }
 *   });
 */

import { Platform } from 'react-native';

type NativeShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

type WebShadow = {
  boxShadow: string;
};

type ElevationLevel = NativeShadow | WebShadow | Record<string, never>;

// ---------------------------------------------------------------------------
// Native elevation levels
// ---------------------------------------------------------------------------
const nativeElevation: Record<0 | 1 | 2 | 3 | 4 | 5, NativeShadow | Record<string, never>> = {
  0: {},
  1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 5,
  },
  4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  5: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
};

// ---------------------------------------------------------------------------
// Web elevation levels (CSS box-shadow)
// ---------------------------------------------------------------------------
const webElevation: Record<0 | 1 | 2 | 3 | 4 | 5, WebShadow | Record<string, never>> = {
  0: {},
  1: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  2: { boxShadow: '0 2px 10px rgba(0,0,0,0.09)' },
  3: { boxShadow: '0 4px 18px rgba(0,0,0,0.12)' },
  4: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  5: { boxShadow: '0 16px 48px rgba(0,0,0,0.18)' },
};

// ---------------------------------------------------------------------------
// Exported map — keyed 0–5 for direct spread into styles
// ---------------------------------------------------------------------------
// Platform.select requires matching types for its branches, so we use
// a direct conditional to avoid the type constraint.
export const Elevation = (
  Platform.OS === 'web' ? webElevation : nativeElevation
) as Record<0 | 1 | 2 | 3 | 4 | 5, ElevationLevel>;

// ---------------------------------------------------------------------------
// Named aliases — for semantic use ("what is this used for?")
// ---------------------------------------------------------------------------
export const ElevationAlias = {
  /** Flat surface — no lift */
  flat:        Elevation[0],
  /** Cards at rest, list rows */
  card:        Elevation[1],
  /** Focused card, active chip, hovered card on web */
  cardRaised:  Elevation[2],
  /** Sticky headers, floating bars */
  sticky:      Elevation[3],
  /** Bottom sheets, sheets, drawers */
  sheet:       Elevation[4],
  /** Toasts, tooltips, popovers */
  popover:     Elevation[5],
} as const;
