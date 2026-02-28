/**
 * Skeleton — animated shimmer placeholder for loading states.
 *
 * Usage:
 *   <Skeleton width="100%" height={120} borderRadius={12} />
 *   <Skeleton width={200} height={16} />
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const baseColor = colors.surface ?? '#E5E7EB';
  const shimmerLight = colors.surfaceElevated ?? '#F3F4F6';

  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius, backgroundColor: baseColor },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[baseColor + '00', shimmerLight, baseColor + '00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
