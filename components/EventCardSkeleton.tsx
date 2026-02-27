/**
 * EventCardSkeleton — shimmer placeholder matching EventCard layout.
 * Rendered while event data is loading.
 *
 * Usage:
 *   {isLoading && Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)}
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './ui/Skeleton';
import { useColors } from '@/hooks/useColors';

export function EventCardSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      {/* Image placeholder */}
      <Skeleton width="100%" height={120} borderRadius={0} />

      {/* Info section */}
      <View style={styles.info}>
        {/* Title — 2 lines */}
        <Skeleton width="90%" height={14} borderRadius={6} style={styles.row} />
        <Skeleton width="70%" height={14} borderRadius={6} style={styles.rowSmall} />

        {/* Date */}
        <Skeleton width={100} height={12} borderRadius={5} style={styles.row} />

        {/* Venue */}
        <Skeleton width="60%" height={12} borderRadius={5} style={styles.rowSmall} />

        {/* Footer: category badge + price */}
        <View style={styles.footer}>
          <Skeleton width={60} height={20} borderRadius={6} />
          <Skeleton width={36} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  info: {
    padding: 14,
  },
  row: {
    marginBottom: 8,
  },
  rowSmall: {
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
