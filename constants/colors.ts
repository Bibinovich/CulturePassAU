// constants/colors.ts
import { Platform } from 'react-native';

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export type ColorTheme = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGlow: string;
  primarySoft: string;

  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  accent: string;
  accentLight: string;

  gold: string;

  background: string;
  backgroundSecondary: string;

  surface: string;
  surfaceElevated: string;
  surfaceSecondary: string;

  border: string;
  borderLight: string;
  divider: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  success: string;
  warning: string;
  error: string;
  info: string;

  overlay: string;
  tabIconDefault: string;
  tabIconSelected: string;
  card: string;
  cardBorder: string;

  tabBar: string;
  tabBarBorder: string;

  tint: string;
};

// Colors that stay exactly the same regardless of light/dark mode
const sharedBase = {
  secondary: '#EE334E',       // Olympic Red
  secondaryLight: '#F4687A',
  secondaryDark: '#C41F38',

  accent: '#FCB131',          // Olympic Yellow/Gold
  accentLight: '#FFD075',

  gold: '#FCB131',            // Olympic Gold

  success: '#00A651',         // Olympic Green
  warning: '#FF9F0A',
  error: '#FF3B30',
  info: '#40A8E8',

  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const light: ColorTheme = {
  ...sharedBase,

  // Primary - Olympic Blue
  primary: '#0081C8',
  primaryLight: '#40A8E8',
  primaryDark: '#005A9E',
  primaryGlow: 'rgba(0, 129, 200, 0.12)',
  primarySoft: 'rgba(0, 129, 200, 0.06)',

  // Backgrounds - Crisp white with cool blue tint
  background: '#F8FBFF',
  backgroundSecondary: '#EEF4FF',

  surface: '#F8FBFF',
  surfaceElevated: '#FFFFFF',
  surfaceSecondary: '#EEF4FF',

  border: '#C5DDEF',
  borderLight: '#DDEEF8',
  divider: '#DDEEF8',

  text: '#001628',
  textSecondary: '#2B4A6E',
  textTertiary: '#7A9AB8',
  textInverse: '#FFFFFF',

  card: '#FFFFFF',
  cardBorder: '#DDEEF8',

  tabBar: 'rgba(248,251,255,0.95)',
  tabBarBorder: 'rgba(0,129,200,0.15)',
  tabIconDefault: '#7A9AB8',
  tabIconSelected: '#0081C8',

  tint: '#0081C8',
};

export const dark: ColorTheme = {
  ...sharedBase,

  // Primary - Lighter Olympic Blue for dark surfaces
  primary: '#40A8E8',
  primaryLight: '#6BC1F0',
  primaryDark: '#0081C8',
  primaryGlow: 'rgba(64, 168, 232, 0.18)',
  primarySoft: 'rgba(64, 168, 232, 0.10)',

  // Backgrounds - Deep Olympic night blue
  background: '#01050D',
  backgroundSecondary: '#091525',

  surface: '#091525',
  surfaceElevated: '#102030',
  surfaceSecondary: '#102030',

  border: '#1A3050',
  borderLight: '#203D62',
  divider: '#1A3050',

  text: '#E8F4FF',
  textSecondary: '#8BB8D8',
  textTertiary: '#4A7A9B',
  textInverse: '#01050D',

  card: '#091525',
  cardBorder: '#1A3050',

  tabBar: 'rgba(1,5,13,0.95)',
  tabBarBorder: 'rgba(64,168,232,0.15)',
  tabIconDefault: '#4A7A9B',
  tabIconSelected: '#40A8E8',

  tint: '#40A8E8',
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  } satisfies ShadowStyle,

  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Slightly increased for a cleaner lift
    shadowRadius: 8,
    elevation: 3,
  } satisfies ShadowStyle,

  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, // More pronounced for modals/popovers
    shadowRadius: 16,
    elevation: 6,
  } satisfies ShadowStyle,

  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  } satisfies ShadowStyle,
};

/**
 * Glassmorphism and futuristic surface presets.
 * Use these on cards/modals for a modern frosted-glass feel.
 */
export const glass = {
  light: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  dark: {
    backgroundColor: 'rgba(28,28,30,0.72)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  /** Semi-transparent overlay for modals/popovers */
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  /** Ultra-clear glass — for hero sections and featured cards */
  ultraLight: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  /** Deep dark glass — for dark mode hero sections */
  ultraDark: {
    backgroundColor: 'rgba(10,10,12,0.82)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
} as const;

/**
 * Gradient tuples ready for LinearGradient `colors` prop.
 * Each pair is [start, end].
 */
export const gradients = {
  /** Primary brand gradient — Olympic Blue to Red */
  primary: ['#0081C8', '#EE334E'] as [string, string],
  /** Warm accent gradient — Olympic Gold to Red */
  accent: ['#FCB131', '#EE334E'] as [string, string],
  /** Premium gold gradient for membership/pro badges */
  gold: ['#FCB131', '#F4A100'] as [string, string],
  /** Dark surface gradient for cards on dark mode */
  darkSurface: ['#091525', '#102030'] as [string, string],
  /** Hero banner overlay (transparent → dark) */
  heroOverlay: ['transparent', 'rgba(0,0,0,0.75)'] as [string, string],
  /** Success / positive action — Olympic Green */
  success: ['#00A651', '#007A3D'] as [string, string],
  /** Aurora — Olympic Blue, Red, Gold */
  aurora: ['#0081C8', '#EE334E', '#FCB131'] as [string, string, string],
  /** Sunset — Red to Gold Olympic warmth */
  sunset: ['#EE334E', '#FCB131', '#FFD700'] as [string, string, string],
  /** Midnight — deep Olympic navy */
  midnight: ['#01050D', '#091525', '#102030'] as [string, string, string],
  /** Festival / Olympic rings celebration */
  festival: ['#0081C8', '#00A651', '#EE334E'] as [string, string, string],
  /** Olympic — full rings: Blue, Yellow, Black, Green, Red */
  olympic: ['#0081C8', '#FCB131', '#EE334E'] as [string, string, string],
} as const;

/**
 * Neon glow tokens for interactive elements (futuristic highlights, active states).
 * Use sparingly — only on focal points, not general UI.
 */
export const neon = {
  blue:   { color: '#0081C8', glow: 'rgba(0, 129, 200, 0.45)' },   // Olympic Blue
  purple: { color: '#40A8E8', glow: 'rgba(64, 168, 232, 0.45)' },  // Light Olympic Blue
  teal:   { color: '#00A651', glow: 'rgba(0, 166, 81, 0.45)' },    // Olympic Green
  gold:   { color: '#FCB131', glow: 'rgba(252, 177, 49, 0.50)' },  // Olympic Gold
  coral:  { color: '#EE334E', glow: 'rgba(238, 51, 78, 0.45)' },   // Olympic Red
} as const;

const Colors = {
  ...light, // Default export maps to light mode variables
  light,
  dark,
  shadow: shadows,
  shadows,
  glass,
  gradients,
} as const;

export default Colors;