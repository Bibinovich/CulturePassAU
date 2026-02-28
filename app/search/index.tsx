import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { api } from '@/lib/api';
import type { EventData, Community, Profile } from '@/shared/schema';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type ResultType = 'event' | 'movie' | 'restaurant' | 'activity' | 'shopping' | 'community';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  imageUrl?: string;
  icon: string;
  color: string;
}

const TYPE_CONFIG: Record<ResultType, { label: string; icon: string; color: string }> = {
  event: { label: 'Events', icon: 'calendar', color: Colors.primary },
  movie: { label: 'Movies', icon: 'film', color: Colors.secondary },
  restaurant: { label: 'Restaurants', icon: 'restaurant', color: Colors.success },
  activity: { label: 'Activities', icon: 'football', color: Colors.info },
  shopping: { label: 'Shopping', icon: 'bag', color: Colors.accent },
  community: { label: 'Communities', icon: 'people', color: Colors.textSecondary },
};

const POPULAR_SEARCHES = ['Diwali', 'Comedy Night', 'Bollywood', 'Food Festival', 'Art Exhibition', 'Cricket'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ResultType | 'all'>('all');
  const { state } = useOnboarding();

  const locationParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (state.country) params.country = state.country;
    if (state.city) params.city = state.city;
    return params;
  }, [state.country, state.city]);

  const { data: events = [] } = useQuery<EventData[]>({
    queryKey: ['/api/events', state.country, state.city],
    queryFn: async () => {
      const data = await api.events.list(locationParams);
      return data.events ?? [];
    },
  });

  const { data: movies = [] } = useQuery<Profile[]>({
    queryKey: ['/api/movies', state.country, state.city],
    queryFn: () => api.movies.list(locationParams),
  });

  const { data: restaurants = [] } = useQuery<Profile[]>({
    queryKey: ['/api/restaurants', state.country, state.city],
    queryFn: () => api.restaurants.list(locationParams),
  });

  const { data: activities = [] } = useQuery<Profile[]>({
    queryKey: ['/api/activities', state.country, state.city],
    queryFn: () => api.activities.list(locationParams),
  });

  const { data: shopping = [] } = useQuery<Profile[]>({
    queryKey: ['/api/shopping', state.country, state.city],
    queryFn: () => api.shopping.list(locationParams),
  });

  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ['/api/communities', state.country, state.city],
    queryFn: () => api.communities.list(locationParams),
  });

  const allResults = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const toLower = (value: unknown) => String(value ?? '').toLowerCase();
    const asString = (value: unknown) => String(value ?? '');
    const asStringArray = (value: unknown) => (Array.isArray(value) ? value.map((v) => String(v)) : []);

    const results: SearchResult[] = [];

    events.forEach((e) => {
      if (toLower(e.title).includes(q) || toLower(e.communityTag).includes(q) || toLower(e.venue).includes(q)) {
        results.push({
          id: e.id,
          type: 'event',
          title: e.title,
          subtitle: `${asString(e.communityTag)} · ${asString(e.venue)}`,
          imageUrl: e.imageUrl,
          icon: TYPE_CONFIG.event.icon,
          color: TYPE_CONFIG.event.color,
        });
      }
    });

    movies.forEach((m) => {
      const movie = m as unknown as Record<string, unknown>;
      const genre = asStringArray(movie.genre);
      if (toLower(movie.title).includes(q) || toLower(movie.language).includes(q) || genre.some((g) => g.toLowerCase().includes(q))) {
        results.push({
          id: asString(movie.id),
          type: 'movie',
          title: asString(movie.title),
          subtitle: `${asString(movie.language)} · ${genre.join(', ')}`,
          imageUrl: asString(movie.posterUrl) || undefined,
          icon: TYPE_CONFIG.movie.icon,
          color: TYPE_CONFIG.movie.color,
        });
      }
    });

    restaurants.forEach((r) => {
      const restaurant = r as unknown as Record<string, unknown>;
      if (toLower(restaurant.name).includes(q) || toLower(restaurant.cuisine).includes(q) || toLower(restaurant.description).includes(q)) {
        results.push({
          id: asString(restaurant.id),
          type: 'restaurant',
          title: asString(restaurant.name),
          subtitle: `${asString(restaurant.cuisine)} · ${asString(restaurant.priceRange)}`,
          imageUrl: asString(restaurant.imageUrl) || undefined,
          icon: TYPE_CONFIG.restaurant.icon,
          color: TYPE_CONFIG.restaurant.color,
        });
      }
    });

    activities.forEach((a) => {
      const activity = a as unknown as Record<string, unknown>;
      if (toLower(activity.name).includes(q) || toLower(activity.category).includes(q) || toLower(activity.description).includes(q)) {
        results.push({
          id: asString(activity.id),
          type: 'activity',
          title: asString(activity.name),
          subtitle: `${asString(activity.category)} · ${asString(activity.priceLabel)}`,
          imageUrl: asString(activity.imageUrl) || undefined,
          icon: TYPE_CONFIG.activity.icon,
          color: TYPE_CONFIG.activity.color,
        });
      }
    });

    shopping.forEach((s) => {
      const shop = s as unknown as Record<string, unknown>;
      if (toLower(shop.name).includes(q) || toLower(shop.category).includes(q) || toLower(shop.description).includes(q)) {
        results.push({
          id: asString(shop.id),
          type: 'shopping',
          title: asString(shop.name),
          subtitle: `${asString(shop.category)} · ${asString(shop.location)}`,
          imageUrl: asString(shop.imageUrl) || undefined,
          icon: TYPE_CONFIG.shopping.icon,
          color: TYPE_CONFIG.shopping.color,
        });
      }
    });

    communities.forEach((c) => {
      if (toLower(c.name).includes(q) || toLower(c.category).includes(q)) {
        results.push({
          id: c.id,
          type: 'community',
          title: c.name ?? 'Community',
          subtitle: `${asString(c.category)} · ${c.membersCount ?? c.memberCount ?? 0} members`,
          icon: TYPE_CONFIG.community.icon,
          color: TYPE_CONFIG.community.color,
        });
      }
    });

    return results;
  }, [query, events, movies, restaurants, activities, shopping, communities]);

  const filteredResults = useMemo(() => {
    if (selectedType === 'all') return allResults;
    return allResults.filter(r => r.type === selectedType);
  }, [allResults, selectedType]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allResults.length };
    allResults.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    return counts;
  }, [allResults]);

  const handleResultPress = (result: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const routes: Record<ResultType, string> = {
      event: '/event/[id]',
      movie: '/movies/[id]',
      restaurant: '/restaurants/[id]',
      activity: '/activities/[id]',
      shopping: '/shopping/[id]',
      community: '/community/[id]',
    };
    router.push({ pathname: routes[result.type] as any, params: { id: result.id } });
  };

  return (
    <ErrorBoundary>
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, restaurants, movies..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {query.length > 0 && allResults.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow} style={{ flexGrow: 0 }}>
          <Pressable
            style={[styles.typeChip, selectedType === 'all' && styles.typeChipActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedType('all'); }}
          >
            <Text style={[styles.typeChipText, selectedType === 'all' && styles.typeChipTextActive]}>All ({typeCounts.all})</Text>
          </Pressable>
          {(Object.keys(TYPE_CONFIG) as ResultType[]).filter(t => typeCounts[t]).map(type => (
            <Pressable
              key={type}
              style={[styles.typeChip, selectedType === type && { backgroundColor: TYPE_CONFIG[type].color, borderColor: TYPE_CONFIG[type].color }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedType(type); }}
            >
              <Ionicons name={TYPE_CONFIG[type].icon as any} size={14} color={selectedType === type ? '#FFF' : TYPE_CONFIG[type].color} />
              <Text style={[styles.typeChipText, selectedType === type && { color: '#FFF' }]}>{TYPE_CONFIG[type].label} ({typeCounts[type]})</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 20 }}>
        {query.length === 0 ? (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Popular Searches</Text>
            <View style={styles.suggestionsGrid}>
              {POPULAR_SEARCHES.map(s => (
                <Pressable key={s} style={styles.suggestionPill} onPress={() => setQuery(s)}>
                  <Ionicons name="trending-up" size={14} color={Colors.primary} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.suggestionsTitle, { marginTop: 28 }]}>Browse Categories</Text>
            <View style={styles.categoriesGrid}>
              {(Object.entries(TYPE_CONFIG) as [ResultType, typeof TYPE_CONFIG[ResultType]][]).map(([key, config]) => (
                <Pressable
                  key={key}
                  style={styles.categoryCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const routes: Record<ResultType, string> = {
                      event: '/(tabs)/explore',
                      movie: '/movies',
                      restaurant: '/restaurants',
                      activity: '/activities',
                      shopping: '/shopping',
                      community: '/(tabs)/communities',
                    };
                    router.push(routes[key] as any);
                  }}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: config.color + '15' }]}>
                    <Ionicons name={config.icon as any} size={24} color={config.color} />
                  </View>
                  <Text style={styles.categoryLabel}>{config.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyDesc}>Try different keywords or browse categories</Text>
          </View>
        ) : (
          <View style={styles.resultsList}>
            <Text style={styles.resultsCount}>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found</Text>
            {filteredResults.map((result, index) => (
              <View key={`${result.type}-${result.id}`}>
                <Pressable style={styles.resultCard} onPress={() => handleResultPress(result)}>
                  {result.imageUrl ? (
                    <Image source={{ uri: result.imageUrl }} style={styles.resultImage} />
                  ) : (
                    <View style={[styles.resultIconBox, { backgroundColor: result.color + '15' }]}>
                      <Ionicons name={result.icon as any} size={22} color={result.color} />
                    </View>
                  )}
                  <View style={styles.resultInfo}>
                    <View style={styles.resultTypeBadge}>
                      <View style={[styles.resultTypeDot, { backgroundColor: result.color }]} />
                      <Text style={styles.resultTypeText}>{TYPE_CONFIG[result.type].label}</Text>
                    </View>
                    <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 44,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: Colors.text, paddingVertical: 0, minWidth: 0 },
  typeRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12, paddingTop: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  typeChipTextActive: { color: '#FFF' },
  suggestionsContainer: { paddingHorizontal: 20, paddingTop: 24 },
  suggestionsTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 14 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: Colors.primary + '08',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  suggestionText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '31%' as any,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginTop: 8 },
  emptyDesc: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center' },
  resultsList: { paddingHorizontal: 20, paddingTop: 8 },
  resultsCount: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary, marginBottom: 12 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  resultImage: { width: 52, height: 52, borderRadius: 12 },
  resultIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1, gap: 2 },
  resultTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultTypeDot: { width: 6, height: 6, borderRadius: 3 },
  resultTypeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  resultSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
});
