/**
 * Badge — small status/category label pill.
 *
 * Variants: default | success | warning | error | info | gold | primary
 *
 * Usage:
 *   <Badge variant="success">Free</Badge>
 *   <Badge variant="gold" icon="star">VIP</Badge>
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'primary';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', icon, size = 'md', style, children }: BadgeProps) {
  const colors = useColors();

  const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
    default:  { bg: colors.surfaceSecondary, text: colors.textSecondary },
    primary:  { bg: colors.primaryGlow,      text: colors.primary },
    success:  { bg: 'rgba(52,199,89,0.15)',  text: colors.success },
    warning:  { bg: 'rgba(255,159,10,0.15)', text: colors.warning },
    error:    { bg: 'rgba(255,59,48,0.15)',  text: colors.error },
    info:     { bg: 'rgba(90,200,250,0.15)', text: colors.info },
    gold:     { bg: 'rgba(255,215,0,0.18)',  text: '#B8860B' },
  };

  const vc = variantMap[variant];
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: vc.bg,
          paddingHorizontal: isSm ? 8 : 10,
          paddingVertical: isSm ? 2 : 4,
          borderRadius: 999,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 10 : 12}
          color={vc.text}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: vc.text,
            fontSize: isSm ? 10 : 11,
            fontFamily: 'Poppins_600SemiBold',
          },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
