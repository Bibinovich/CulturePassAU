import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';
import { useSaved } from '@/contexts/SavedContext';
import * as Haptics from 'expo-haptics';
import type { EventData } from '@/shared/schema';

interface EventCardProps {
  event: EventData;
}

function EventCardInner({ event }: EventCardProps) {
  const { isEventSaved, toggleSaveEvent } = useSaved();
  const isSaved = isEventSaved(event.id);
  const [hovered, setHovered] = useState(false);

  const handleCardPress = useCallback(() => {
    router.push({ pathname: '/event/[id]', params: { id: event.id } });
  }, [event.id]);

  const handleSavePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaveEvent(event.id);
  }, [event.id, toggleSaveEvent]);

  const priceDisplay = event.priceLabel ?? (
    event.priceCents === 0 ? 'Free' :
    event.priceCents != null ? `$${(event.priceCents / 100).toFixed(2)}` :
    null
  );
  const ageBadge = event.ageSuitability && event.ageSuitability !== 'all'
    ? event.ageSuitability
    : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        Platform.OS === 'web' && hovered && styles.cardHovered,
      ]}
      onPress={handleCardPress}
      onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
      onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
    >
      <Image
        source={{ uri: event.imageUrl ?? undefined }}
        style={[styles.image, Platform.OS === 'web' && hovered && styles.imageHovered]}
        contentFit="cover"
        transition={200}
      />
      {ageBadge && (
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>{ageBadge}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.date}>{event.date}</Text>
        {event.venue ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{event.venue}</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {event.category ? (
              <Text style={styles.category}>{event.category}</Text>
            ) : null}
            {priceDisplay ? (
              <Text style={styles.price}>{priceDisplay}</Text>
            ) : null}
          </View>
          <Pressable style={styles.saveButton} onPress={handleSavePress} hitSlop={8}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSaved ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// Memoize to avoid re-renders when parent re-renders with unchanged event data
const EventCard = React.memo(EventCardInner);
export default EventCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Colors.shadow.small,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  // Web-only: elevate card on hover
  cardHovered: {
    ...Colors.shadow.medium,
    transform: [{ scale: 1.015 }],
  },
  image: {
    width: '100%',
    height: 120,
  },
  imageHovered: {
    // expo-image handles transition internally — no extra style needed
  },
  ageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ageBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#FFF',
  },
  info: {
    padding: 14,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 20,
  },
  date: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  metaText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  category: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: Colors.secondary,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  price: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  saveButton: {
    padding: 4,
  },
});
