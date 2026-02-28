/**
 * Button — CulturePassAU design system component.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm | md | lg
 *
 * Usage:
 *   <Button onPress={handleSubmit} loading={isLoading}>Buy Ticket</Button>
 *   <Button variant="ghost" size="sm" leftIcon="bookmark-outline">Save</Button>
 */

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ButtonTokens } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  style,
  labelStyle,
  children,
  onPress,
  ...rest
}: ButtonProps) {
  const colors = useColors();

  const height = ButtonTokens.height[size];
  const paddingH = ButtonTokens.paddingH[size];
  const fontSize = ButtonTokens.fontSize[size];
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  const isDisabled = disabled || loading;

  // Resolve colors per variant
  const variantColors = {
    primary:   { bg: colors.primary,    border: 'transparent', label: '#FFFFFF' },
    secondary: { bg: colors.primaryGlow, border: colors.primary, label: colors.primary },
    ghost:     { bg: 'transparent',     border: 'transparent', label: colors.primary },
    danger:    { bg: colors.error,       border: 'transparent', label: '#FFFFFF' },
    gold:      { bg: '#FFD700',          border: 'transparent', label: '#000000' },
  } as const;

  const vc = variantColors[variant];

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: paddingH,
          backgroundColor: vc.bg,
          borderColor: vc.border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: ButtonTokens.radius,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vc.label} size={iconSize} />
      ) : (
        <View style={styles.row}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={iconSize}
              color={vc.label}
              style={{ marginRight: ButtonTokens.iconGap }}
            />
          )}
          <Text
            style={[
              styles.label,
              { color: vc.label, fontSize, fontFamily: 'Poppins_600SemiBold' },
              labelStyle,
            ]}
            numberOfLines={1}
          >
            {children}
          </Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={iconSize}
              color={vc.label}
              style={{ marginLeft: ButtonTokens.iconGap }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    letterSpacing: 0.1,
  },
});
