/**
 * CulturePassAU Design System — Master Export
 * ============================================
 *
 * Import everything from this one file instead of hunting across
 * individual constants files:
 *
 *   import { Colors, TextStyles, Elevation, Spacing, ButtonTokens } from '@/constants/theme';
 *
 * ---------------------------------------------------------------------------
 * LAYOUT RULES — Web vs Mobile
 * ---------------------------------------------------------------------------
 *
 * Breakpoints:
 *   Mobile   < 768px   — single-column hero, 2-column grid, 16–20px h-padding
 *   Tablet   768–1023px — 2–3 column grid, 24px h-padding, 768px max-width
 *   Desktop  ≥ 1024px  — 3–4 column grid, 32px h-padding, 1280px max-width
 *
 * Web shell (app/_layout.tsx WebShell):
 *   Mobile web  → 480px phone-shell on dark background
 *   Tablet web  → 768px container on light background
 *   Desktop web → up to 1280px container on light background
 *
 * Navigation:
 *   Mobile  → bottom tab bar, 84px height
 *   Desktop → bottom tab bar, 64px height (no sidebar yet)
 *
 * Grid columns (Events screen):
 *   Mobile  → 2 columns
 *   Desktop → 3 columns
 *
 * Horizontal padding:
 *   Mobile  → 16–20px
 *   Tablet  → 24px
 *   Desktop → 32px
 *
 * Use the `useLayout()` hook (hooks/useLayout.ts) to get these values
 * reactively in any component:
 *
 *   const { isDesktop, numColumns, hPad } = useLayout();
 *
 * ---------------------------------------------------------------------------
 * COLOR ROLES
 * ---------------------------------------------------------------------------
 *
 * primary     — CTA buttons, links, active states
 * secondary   — Accent color (purple), secondary CTAs
 * accent      — Warning/highlight (orange)
 * gold        — Premium / membership tier
 *
 * background  — Page background
 * surface     — Card / modal background (elevated over background)
 * surfaceElevated — Further lifted surface (nested cards, inputs)
 *
 * text        — Primary readable text
 * textSecondary — Supporting text, captions
 * textTertiary  — Placeholder text, disabled labels
 *
 * border      — Standard border
 * borderLight — Hairline dividers, card outlines
 * divider     — Full-width separators
 *
 * success / warning / error / info — Status colors
 *
 * Use `useColors()` (hooks/useColors.ts) for dark-mode-aware color access:
 *
 *   const colors = useColors();
 *   <Text style={{ color: colors.primary }}>...</Text>
 */

// ---------------------------------------------------------------------------
// Re-exports — single import surface
// ---------------------------------------------------------------------------
export { default as Colors, light as lightColors, dark as darkColors, shadows, glass, gradients, neon } from './colors';
export type { ColorTheme, ShadowStyle } from './colors';

export {
  Spacing,
  Radius,
  Breakpoints,
  Layout,
} from './spacing';

export {
  FontFamily,
  FontSize,
  LineHeight,
  LetterSpacing,
  TextStyles,
  DesktopTextStyles,
  Typography,          // legacy
} from './typography';

export {
  Elevation,
  ElevationAlias,
} from './elevation';

export {
  Duration,
  SpringConfig,
  prefersReducedMotion,
} from './animations';

// ---------------------------------------------------------------------------
// Component tokens
// Used to keep button heights, card paddings, input sizes consistent.
// ---------------------------------------------------------------------------

/**
 * Button component tokens.
 * Use these to build all button variants — never hardcode sizes.
 */
export const ButtonTokens = {
  height: {
    sm: 36,  // Ghost / text buttons
    md: 44,  // Standard CTA (Apple minimum touch target)
    lg: 52,  // Primary hero CTA
  },
  paddingH: {
    sm: 16,
    md: 20,
    lg: 28,
  },
  radius: 12,
  radiusPill: 9999,
  fontSize: {
    sm: 14,
    md: 15,
    lg: 16,
  },
  iconGap: 8,
} as const;

/**
 * Card component tokens.
 * Shared by EventCard, CommunityCard, CategoryCard etc.
 */
export const CardTokens = {
  radius: 16,
  radiusLarge: 20,
  padding: 14,
  paddingLarge: 18,
  imageHeight: {
    mobile: 120,
    tablet: 140,
    desktop: 160,
  },
  gap: {
    mobile: 14,
    desktop: 16,
  },
  minWidth: 160,
} as const;

/**
 * Input component tokens.
 * Text inputs, search bars, dropdowns.
 */
export const InputTokens = {
  height: 48,
  heightSearch: 44,
  radius: 12,
  fontSize: 16,
  paddingH: 16,
  paddingV: 12,
  iconSize: 20,
  iconGap: 10,
} as const;

/**
 * Chip / filter pill tokens.
 */
export const ChipTokens = {
  height: 36,
  paddingH: 16,
  paddingV: 8,
  radius: 50,
  fontSize: 13,
  gap: 8,
} as const;

/**
 * Bottom sheet / modal tokens.
 */
export const SheetTokens = {
  borderRadius: 24,
  handleHeight: 4,
  handleWidth: 40,
  handleColor: 'rgba(0,0,0,0.2)',
  minHandleHitSlop: 20,
  headerHeight: 56,
} as const;

/**
 * Avatar / profile photo tokens.
 */
export const AvatarTokens = {
  size: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
    xxl: 96,
  },
  radius: 9999,      // Always circular
  badgeSize: 12,
  badgeOffset: 2,
} as const;

/**
 * Tab bar tokens (used by app/(tabs)/_layout.tsx).
 */
export const TabBarTokens = {
  heightMobile: 84,
  heightDesktop: 64,
  iconSize: 24,
  labelSize: 10,
  labelSizeDesktop: 11,
} as const;

/**
 * Section header tokens — "See All" rows, section titles.
 */
export const SectionTokens = {
  titleFontFamily: 'Poppins_700Bold',
  titleFontSize: 20,
  titleLineHeight: 28,
  iconSize: 22,
  verticalPadding: 8,
  mobileHorizontalPadding: 20,
  desktopHorizontalPadding: 32,
} as const;

// ---------------------------------------------------------------------------
// Icon size scale — consistent icon sizing across all components
// ---------------------------------------------------------------------------
export const IconSize = {
  xs:   12,
  sm:   16,
  md:   20,
  lg:   24,
  xl:   32,
  xxl:  40,
} as const;

// ---------------------------------------------------------------------------
// Z-index scale — never use raw numbers for z-index
// ---------------------------------------------------------------------------
export const ZIndex = {
  base:       0,
  raised:     10,
  dropdown:   100,
  sticky:     200,
  overlay:    300,
  modal:      400,
  toast:      500,
  tooltip:    600,
} as const;
