/**
 * Card — surface container with optional press, shadow, and glassmorphism.
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card onPress={handlePress} shadow="medium">...</Card>
 *   <Card glass>...</Card>
 */

import React from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { shadows, glass } from '@/constants/theme';
import { CardTokens } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useColorScheme } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  onPress?: () => void;
  shadow?: keyof typeof shadows;
  /** Enable glassmorphism background */
  glass?: boolean;
  /** Override internal padding */
  padding?: number;
  /** Override border radius */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Card({
  onPress,
  shadow: shadowKey = 'medium',
  glass: isGlass = false,
  padding = CardTokens.padding,
  radius = CardTokens.radius,
  style,
  children,
}: CardProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    if (!onPress) return;
    scale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  }
  function handlePressOut() {
    if (!onPress) return;
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }

  const glassPreset = isDark ? glass.dark : glass.light;
  const glassStyle: { backgroundColor: string; borderColor?: string } = isGlass
    ? glassPreset
    : { backgroundColor: colors.card };

  const cardStyle = [
    styles.card,
    shadows[shadowKey],
    glassStyle,
    {
      borderRadius: radius,
      padding,
      borderColor: isGlass
        ? glassStyle.borderColor
        : colors.cardBorder,
      borderWidth: 1,
    },
    Platform.OS === 'web' && onPress ? (styles.webHover as object) : undefined,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animStyle, cardStyle]}
        accessibilityRole="button"
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View style={[animStyle, cardStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  webHover: Platform.OS === 'web'
    ? {
        // @ts-ignore — web-only hover effect
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        cursor: 'pointer',
      }
    : {},
});
