/**
 * Typography scale for CulturePassAU.
 *
 * Design rules:
 *  - Font family: Poppins exclusively (loaded in app/_layout.tsx — no iOS system font)
 *  - Base body: 16px / 24px line-height (1.5 ratio)
 *  - Display text: tighter leading (~1.2–1.3×) — large sizes read better compressed
 *  - All sizes and line-heights are multiples of 4 (aligns with the 4-point spacing grid)
 *  - Letter spacing follows Apple HIG conventions adapted for Poppins
 *
 * Usage:
 *   import { TextStyles, FontFamily, FontSize } from '@/constants/typography';
 *   <Text style={TextStyles.title}>Hello</Text>
 *
 *   // Responsive override (spread + override):
 *   <Text style={[TextStyles.title, isDesktop && DesktopTextStyles.title]}>Hello</Text>
 */

// ---------------------------------------------------------------------------
// Font family aliases
// ---------------------------------------------------------------------------
export const FontFamily = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
} as const;

// ---------------------------------------------------------------------------
// Font size scale (all multiples of 4 or standard type sizes)
// ---------------------------------------------------------------------------
export const FontSize = {
  tab:     10,   // Tab bar labels only
  micro:   11,   // Badges, pills, micro-labels
  caption: 12,   // Timestamps, secondary metadata
  chip:    13,   // Filter chips, tag labels
  body2:   14,   // Card body, secondary labels
  callout: 15,   // Supporting text, callouts
  body:    16,   // Primary reading text (base)
  title3:  18,   // Card headers, section subheadings
  title2:  20,   // Screen sub-headers
  title:   24,   // Screen-level headings
  hero:    28,   // Hero section headings
  display: 32,   // Landing / marketing display
} as const;

// ---------------------------------------------------------------------------
// Line height scale (multiples of 4 — stays on 4-point grid)
// ---------------------------------------------------------------------------
export const LineHeight = {
  tab:     12,
  micro:   16,
  caption: 16,
  chip:    20,
  body2:   20,
  callout: 22,  // ~1.47× callout
  body:    24,  // 1.5× body — optimal for reading
  title3:  28,  // 1.55× title3
  title2:  28,  // 1.4× title2
  title:   32,  // 1.33× title
  hero:    36,  // 1.29× hero
  display: 40,  // 1.25× display — tight at large sizes
} as const;

// ---------------------------------------------------------------------------
// Letter spacing
// ---------------------------------------------------------------------------
export const LetterSpacing = {
  tight:  -0.5,
  normal:  0,
  wide:    0.3,
  wider:   0.8,
  cap:     1.2,   // All-caps labels (RSVP, SYD, etc.)
} as const;

// ---------------------------------------------------------------------------
// Composed text style presets — ready for StyleSheet / inline use
// ---------------------------------------------------------------------------
export const TextStyles = {

  // Display / marketing
  display: {
    fontFamily: FontFamily.bold,
    fontSize:   FontSize.display,
    lineHeight: LineHeight.display,
    letterSpacing: LetterSpacing.tight,
  },
  hero: {
    fontFamily: FontFamily.bold,
    fontSize:   FontSize.hero,
    lineHeight: LineHeight.hero,
    letterSpacing: LetterSpacing.tight,
  },

  // Screen headings
  title: {
    fontFamily: FontFamily.bold,
    fontSize:   FontSize.title,
    lineHeight: LineHeight.title,
    letterSpacing: LetterSpacing.tight,
  },
  title2: {
    fontFamily: FontFamily.bold,
    fontSize:   FontSize.title2,
    lineHeight: LineHeight.title2,
    letterSpacing: LetterSpacing.tight,
  },
  title3: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.title3,
    lineHeight: LineHeight.title3,
  },

  // UI text
  headline: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.body,
    lineHeight: LineHeight.body,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.body,
    lineHeight: LineHeight.body,
  },
  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.body,
    lineHeight: LineHeight.body,
  },
  callout: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.callout,
    lineHeight: LineHeight.callout,
  },

  // Card / component text
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.body2,
    lineHeight: LineHeight.body2,
  },
  cardBody: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.body2,
    lineHeight: LineHeight.body2,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.body2,
    lineHeight: LineHeight.body2,
  },
  labelSemibold: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.body2,
    lineHeight: LineHeight.body2,
  },

  // Metadata / secondary
  chip: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.chip,
    lineHeight: LineHeight.chip,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    lineHeight: LineHeight.caption,
  },
  captionSemibold: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.caption,
    lineHeight: LineHeight.caption,
  },

  // Badges / pills / micro
  badge: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.micro,
    lineHeight: LineHeight.micro,
    letterSpacing: LetterSpacing.wide,
  },
  badgeCaps: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.micro,
    lineHeight: LineHeight.micro,
    letterSpacing: LetterSpacing.cap,
    textTransform: 'uppercase' as const,
  },

  // Navigation
  tabLabel: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.tab,
    lineHeight: LineHeight.tab,
  },

} as const;

// ---------------------------------------------------------------------------
// Desktop overrides — spread over TextStyles for larger screens
//
// Usage: style={[TextStyles.title, isDesktop && DesktopTextStyles.title]}
// ---------------------------------------------------------------------------
export const DesktopTextStyles = {
  display: { fontSize: 40, lineHeight: 52 },
  hero:    { fontSize: 36, lineHeight: 44 },
  title:   { fontSize: 28, lineHeight: 36 },
  title2:  { fontSize: 24, lineHeight: 32 },
} as const;

// ---------------------------------------------------------------------------
// Legacy export: keeps existing code that imports { Typography } compiling.
// Prefer TextStyles for all new code.
// ---------------------------------------------------------------------------
/** @deprecated Use TextStyles from this file instead */
export const Typography = {
  largeTitle:   { ...TextStyles.title,  fontSize: 34, lineHeight: 40 },
  title1:       { ...TextStyles.title,  fontSize: 28, lineHeight: 36 },
  title2:       TextStyles.title2,
  title3:       TextStyles.title3,
  headline:     TextStyles.headline,
  body:         TextStyles.body,
  callout:      TextStyles.callout,
  subheadline:  TextStyles.callout,
  footnote:     TextStyles.caption,
  caption1:     TextStyles.caption,
  caption2:     TextStyles.badge,
  hero:         TextStyles.hero,
  section:      TextStyles.title3,
  cardTitle:    TextStyles.cardTitle,
  small:        TextStyles.caption,
};
