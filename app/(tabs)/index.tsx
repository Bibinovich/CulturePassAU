import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import type { User, EventData, Community } from '@shared/schema';
import { getQueryFn } from '@/lib/query-client';
import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { LocationPicker } from '@/components/LocationPicker';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { api } from '@/lib/api';
import EventCard from '@/components/Discover/EventCard';
import CategoryCard from '@/components/Discover/CategoryCard';
import CommunityCard from '@/components/Discover/CommunityCard';
import CityCard from '@/components/Discover/CityCard';
import { Colors } from '@/constants/theme';
import { FilterChip } from '@/components/FilterChip';

const isWeb = Platform.OS === 'web';

const superAppSections = [
  { id: 'movies', label: 'Movies', icon: 'film', color: Colors.error, route: '/movies' },
  { id: 'restaurants', label: 'Dining', icon: 'restaurant', color: Colors.accent, route: '/restaurants' },
  { id: 'activities', label: 'Activities', icon: 'compass', color: Colors.success, route: '/activities' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle', color: '#AF52DE', route: '/shopping' },
  { id: 'events', label: 'Events', icon: 'calendar', color: Colors.tint, route: '/explore' },
  { id: 'directory', label: 'Directory', icon: 'storefront', color: Colors.secondary, route: '/directory' },
];

const SECTION_ROUTES: Record<string, string> = {
  movies: '/movies',
  restaurants: '/restaurants',
  activities: '/activities',
  shopping: '/shopping',
  events: '/(tabs)/explore',
  directory: '/(tabs)/directory',
};

const browseCategories = [
  { id: 'c1', label: 'Music', icon: 'musical-notes', color: '#FF6B6B' },
  { id: 'c2', label: 'Dance', icon: 'body', color: '#4ECDC4' },
  { id: 'c3', label: 'Food', icon: 'restaurant', color: Colors.warning },
  { id: 'c4', label: 'Art', icon: 'color-palette', color: '#A855F7' },
  { id: 'c5', label: 'Wellness', icon: 'heart', color: Colors.error },
  { id: 'c6', label: 'Film', icon: 'film', color: Colors.info },
  { id: 'c7', label: 'Workshop', icon: 'construct', color: Colors.accent },
  { id: 'c8', label: 'Heritage', icon: 'library', color: '#8B4513' },
];

const WEB_CATEGORIES = ['All', 'Music', 'Dance', 'Food', 'Art', 'Wellness', 'Film', 'Workshop', 'Heritage'];

const FEATURED_CITIES = [
  { name: 'Sydney', country: 'Australia' },
  { name: 'Melbourne', country: 'Australia' },
  { name: 'Auckland', country: 'New Zealand' },
  { name: 'Dubai', country: 'UAE' },
  { name: 'London', country: 'United Kingdom' },
  { name: 'Toronto', country: 'Canada' },
  { name: 'Vancouver', country: 'Canada' },
  { name: 'Brisbane', country: 'Australia' },
];

interface DiscoverSection {
  title: string;
  subtitle?: string;
  type: 'events' | 'communities' | 'businesses' | 'activities' | 'spotlight' | 'mixed';
  items: Record<string, unknown>[];
  priority: number;
}

interface DiscoverFeed {
  sections: DiscoverSection[];
  meta: {
    userId: string;
    city: string;
    country: string;
    generatedAt: string;
    totalItems: number;
  };
}

interface TraditionalLand {
  id: string;
  city: string;
  landName: string;
  traditionalCustodians: string;
}

interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  type?: string;
}

interface CultureCard {
  id: string;
  label: string;
  color: string;
  emoji?: string;
  icon: string;
}


function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <Pressable
          style={styles.seeAllButton}
          onPress={onSeeAll}
          hitSlop={12}
        >
          <Text style={styles.seeAll}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.tint} />
        </Pressable>
      )}
    </View>
  );
}

function SpotlightCard({ item, index = 0 }: { item: SpotlightItem; index?: number }) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [
          styles.spotlightCard,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          Platform.OS === 'web' && { cursor: 'pointer' as any },
          Colors.shadows.medium,
        ]}
        onPress={() => {
          if (item.type === 'event') router.push({ pathname: '/event/[id]', params: { id: item.id } });
        }}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(93, 64, 55, 0.95)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.spotlightBadge}>
          <Ionicons name="earth" size={10} color="#FFF" />
          <Text style={styles.spotlightBadgeText}>First Nations</Text>
        </View>
        <View style={styles.spotlightContent}>
          <Text style={styles.spotlightTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.spotlightDesc} numberOfLines={2}>{item.description}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function eventToTimestamp(event: EventData): number {
  const [year, month, day] = (event.date ?? '').split('-').map(Number);
  if (!year || !month || !day) return Number.POSITIVE_INFINITY;
  return new Date(year, month - 1, day).getTime();
}

function WebEventRailCard({ event }: { event: EventData }) {
  const rawDate = event.date ?? '';
  const dateChip = rawDate.length >= 7 ? rawDate.slice(5).replace('-', ' ') : rawDate;
  const category = event.category || event.communityTag || 'Event';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.webRailCard,
        pressed && { opacity: 0.9 },
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
    >
      <Image source={{ uri: event.imageUrl }} style={styles.webRailImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']}
        locations={[0.3, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {dateChip ? (
        <View style={styles.webRailDateChip}>
          <Text style={styles.webRailDateChipText}>{dateChip}</Text>
        </View>
      ) : null}
      <View style={styles.webRailCatTag}>
        <Text style={styles.webRailCatText} numberOfLines={1}>{category}</Text>
      </View>
      <View style={styles.webRailMeta}>
        <Text style={styles.webRailTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.webRailVenueRow}>
          <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.6)" />
          <Text style={styles.webRailVenue} numberOfLines={1}>{event.venue || event.city}</Text>
        </View>
        <View style={styles.webRailBottom}>
          <LinearGradient
            colors={['#0081C8', '#EE334E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.webRailPricePill}
          >
            <Text style={styles.webRailPriceText}>{event.priceLabel || 'Free'}</Text>
          </LinearGradient>
          <Ionicons name="bookmark-outline" size={18} color="rgba(255,255,255,0.7)" />
        </View>
      </View>
    </Pressable>
  );
}

function WebRailSection({
  title,
  subtitle,
  events,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  events: EventData[];
  onSeeAll?: () => void;
}) {
  if (events.length === 0) return null;
  return (
    <View style={styles.webSection}>
      <View style={styles.webSectionHeader}>
        <View style={styles.webSectionTitleRow}>
          <LinearGradient
            colors={['#0081C8', '#EE334E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.webSectionAccentBar}
          />
          <View>
            <Text style={styles.webSectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.webSectionSub}>{subtitle}</Text> : null}
          </View>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} style={styles.webSeeAllBtn}>
            <Text style={styles.webSeeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.webRailScroll}>
        {events.map((event) => (
          <WebEventRailCard key={event.id} event={event} />
        ))}
      </ScrollView>
    </View>
  );
}

function WebHeroCarousel({ events }: { events: EventData[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenW = Dimensions.get('window').width;
  const isDesktopW = Platform.OS === 'web' && screenW >= 1024;
  const heroHeight = isDesktopW ? 380 : 240;

  const goTo = (index: number) => {
    setCurrent(index);
    if (timerRef.current) clearInterval(timerRef.current);
    if (events.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % events.length);
      }, 4500);
    }
  };

  useEffect(() => {
    if (events.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % events.length);
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [events.length]);

  if (events.length === 0) {
    return (
      <View style={[styles.webHeroCarousel, { height: heroHeight }]}>
        <LinearGradient
          colors={['#0081C8', '#003F80', '#EE334E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.webHeroCarouselMeta}>
          <Text style={styles.webHeroCarouselTitle}>Explore Cultural Events</Text>
          <Text style={styles.webHeroCarouselSub}>Discover events near you</Text>
        </View>
      </View>
    );
  }

  const event = events[current];
  return (
    <View style={[styles.webHeroCarousel, { height: heroHeight }]}>
      <Image source={{ uri: event.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.webHeroCatBadge}>
        <Text style={styles.webHeroCatBadgeText}>{event.communityTag || event.category || 'Featured'}</Text>
      </View>
      {isDesktopW && events.length > 1 && (
        <View style={[StyleSheet.absoluteFillObject, styles.webHeroArrowContainer]}>
          <Pressable style={styles.webHeroArrow} onPress={() => goTo((current - 1 + events.length) % events.length)}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.webHeroArrow} onPress={() => goTo((current + 1) % events.length)}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        </View>
      )}
      <View style={styles.webHeroCarouselMeta}>
        <Text style={styles.webHeroCarouselTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.webHeroCarouselSub} numberOfLines={1}>{event.venue || event.city} · {event.date}</Text>
        <Pressable
          style={styles.webHeroCarouselCta}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
        >
          <Text style={styles.webHeroCarouselCtaText}>Get Tickets →</Text>
        </Pressable>
      </View>
      {events.length > 1 && (
        <View style={styles.webHeroDots}>
          {events.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)} style={[styles.webHeroDot, i === current && styles.webHeroDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { state } = useOnboarding();
  const { isAuthenticated, userId: authUserId, user: authUser } = useAuth();

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const { data: traditionalLandsData = [] } = useQuery<TraditionalLand[]>({
    queryKey: ['/api/indigenous/traditional-lands'],
    queryFn: () => api.raw('GET', 'api/indigenous/traditional-lands'),
  });

  const { data: allEvents = [] } = useQuery<EventData[]>({
    queryKey: ['/api/events', state.country, state.city],
    queryFn: async () => {
      const result = await api.events.list({
        country: state.country || undefined,
        city: state.city || undefined,
        pageSize: 50,
      });
      return result.events ?? [];
    },
  });

  const { data: allCommunities = [] } = useQuery<Community[]>({
    queryKey: ['/api/communities', state.city, state.country],
    queryFn: () => api.communities.list({
      city:    state.city    || undefined,
      country: state.country || undefined,
    }),
  });

  const { data: spotlights = [] } = useQuery<SpotlightItem[]>({
    queryKey: ['/api/indigenous/spotlights'],
    queryFn: () => api.raw('GET', 'api/indigenous/spotlights'),
  });

  const { data: discoverFeed, isLoading: discoverLoading, refetch } = useQuery<DiscoverFeed>({
    queryKey: ['/api/discover', authUserId ?? 'guest', state.city, state.country],
    queryFn: async () => {
      if (authUserId) {
        const qs = new URLSearchParams();
        if (state.city)    qs.set('city',    state.city);
        if (state.country) qs.set('country', state.country);
        const q = qs.toString();
        return api.raw('GET', `api/discover/${authUserId}${q ? `?${q}` : ''}`);
      }
      return { sections: [], meta: { userId: 'guest', city: state.city ?? '', country: state.country ?? '', generatedAt: new Date().toISOString(), totalItems: 0 } };
    },
  });

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = useMemo(() => {
    if (!isAuthenticated) return 'Explorer';
    const name = authUser?.displayName ?? authUser?.username ?? '';
    return name.split(' ')[0] || 'Explorer';
  }, [isAuthenticated, authUser]);

  const sections = discoverFeed?.sections ?? [];
  const nearYou = sections.find(s => s.title === 'Near You');
  const popularEvents = useMemo(() => {
    if (nearYou?.items?.length) {
      return nearYou.items.filter((e) => Boolean(e.venue)).slice(0, 12);
    }
    return [...allEvents]
      .sort((a, b) => (b.attending || 0) - (a.attending || 0))
      .filter((e) => Boolean(e.venue))
      .slice(0, 12);
  }, [nearYou, allEvents]);
  const featuredEvent = allEvents.find((e) => e.isFeatured) || allEvents[0];
  const otherSections = sections.filter(s => s.title !== 'Near You');

  const cultureCards = useMemo<CultureCard[]>(() => {
    const types: Record<string, CultureCard[]> = {};
    allCommunities.forEach((c) => {
      const key = c.type || 'other';
      if (!types[key]) types[key] = [];
      if (types[key].length < 8) {
        types[key].push({
          id: c.id,
          label: c.name?.split(' ')[0] || c.name || 'Community',
          color: Colors.primary,
          emoji: c.iconEmoji,
          icon: 'people',
        });
      }
    });
    const all = Object.values(types).flat();
    return all.slice(0, 10);
  }, [allCommunities]);

  const screenWidth = Dimensions.get('window').width;
  // On desktop web, expand to full content area width (sidebar is 240px wide)
  const isDesktopWeb = Platform.OS === 'web' && screenWidth >= 1024;
  const maxWidth = Platform.OS === 'web'
    ? (isDesktopWeb ? screenWidth - 240 : Math.min(screenWidth, 480))
    : screenWidth;
  const cityCardWidth = (maxWidth - 40 - 14) / 2;

  const [refreshing, setRefreshing] = useState(false);
  const [webSearch, setWebSearch] = useState('');
  const [webCategoryFilter, setWebCategoryFilter] = useState('All');
  const categoryFilteredEvents = useCallback((evts: EventData[]) => {
    if (webCategoryFilter === 'All') return evts;
    return evts.filter((event) => {
      const bucket = `${event.category ?? ''} ${event.communityTag ?? ''} ${(event.tags ?? []).join(' ')} ${event.title}`.toLowerCase();
      return bucket.includes(webCategoryFilter.toLowerCase());
    });
  }, [webCategoryFilter]);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const land = traditionalLandsData.find((l) => l.city === state.city);
  const searchableEvents = useMemo(
    () => allEvents.filter((event) => Boolean(event.imageUrl && event.venue)),
    [allEvents]
  );
  const filterEventsForWeb = useCallback((events: EventData[]) => {
    const term = webSearch.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => {
      const bucket = `${event.title} ${event.venue ?? ''} ${event.communityTag ?? ''} ${event.city ?? ''}`.toLowerCase();
      return bucket.includes(term);
    });
  }, [webSearch]);
  const webFeatured = useMemo(
    () => filterEventsForWeb([...searchableEvents].sort((a, b) => (b.attending ?? 0) - (a.attending ?? 0)).slice(0, 12)),
    [searchableEvents, filterEventsForWeb]
  );
  const webActivities = useMemo(
    () => filterEventsForWeb(searchableEvents.filter((event) => {
      const category = `${event.category ?? ''} ${event.communityTag ?? ''}`.toLowerCase();
      return category.includes('workshop') || category.includes('activity') || category.includes('food') || category.includes('wellness');
    }).slice(0, 12)),
    [searchableEvents, filterEventsForWeb]
  );
  const webArtists = useMemo(
    () => filterEventsForWeb(searchableEvents.filter((event) => {
      const tag = `${event.organizer ?? ''} ${event.title}`.toLowerCase();
      return tag.includes('dj') || tag.includes('artist') || tag.includes('band') || tag.includes('live');
    }).slice(0, 12)),
    [searchableEvents, filterEventsForWeb]
  );
  const webUpcoming = useMemo(
    () => filterEventsForWeb([...searchableEvents].sort((a, b) => eventToTimestamp(a) - eventToTimestamp(b)).slice(0, 12)),
    [searchableEvents, filterEventsForWeb]
  );
  const webHeroEvents = useMemo(
    () => (webFeatured.length > 0 ? webFeatured : searchableEvents).slice(0, 6),
    [webFeatured, searchableEvents]
  );

  // Interest-based "For You" recommendations — matches user's stored interests
  const webForYou = useMemo(() => {
    const interests = state.interests ?? [];
    if (!interests.length) return filterEventsForWeb(webFeatured.slice(0, 12));
    const matched = filterEventsForWeb(
      searchableEvents.filter((event) => {
        const bucket = `${event.category ?? ''} ${event.communityTag ?? ''} ${event.title} ${event.tags?.join(' ') ?? ''}`.toLowerCase();
        return interests.some((i) => bucket.includes(i.toLowerCase()));
      })
    ).slice(0, 12);
    return matched.length >= 3 ? matched : filterEventsForWeb(webFeatured.slice(0, 12));
  }, [searchableEvents, state.interests, filterEventsForWeb, webFeatured]);

  // City-based "Near You" recommendations
  const webNearYou = useMemo(() => {
    if (!state.city) return [];
    return filterEventsForWeb(
      searchableEvents.filter((event) =>
        (event.city ?? '').toLowerCase() === state.city.toLowerCase()
      )
    ).slice(0, 12);
  }, [searchableEvents, state.city, filterEventsForWeb]);

  if (isWeb) {
    return (
      <ErrorBoundary>
        <View style={[styles.container, { paddingTop: topInset }]}>
          <LinearGradient
            colors={['#090A13', '#0F131F', '#0A111C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.webScrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E7EEF7" />}
          >
            {/* Header */}
            <View style={styles.webTopRow}>
              <View>
                <View style={styles.webLocationRow}>
                  <Ionicons name="location-outline" size={18} color="#F2A93B" />
                  <Text style={styles.webLocationText}>{state.city || 'Sydney'}, {state.country || 'Australia'}</Text>
                </View>
                <Text style={styles.webGreeting}>{timeGreeting}, {firstName}</Text>
                <Text style={styles.webHeading}>Discover experiences around you</Text>
              </View>
              <View style={styles.webTopActions}>
                <Pressable style={styles.webIconBtn} onPress={() => router.push('/map' as any)}>
                  <Ionicons name="map-outline" size={19} color="#EAF0FF" />
                </Pressable>
                <Pressable style={styles.webIconBtn} onPress={() => router.push('/notifications')}>
                  <Ionicons name="notifications-outline" size={19} color="#EAF0FF" />
                </Pressable>
                <View style={styles.webAvatarBtn}>
                  <Text style={styles.webAvatarText}>{firstName.slice(0, 1).toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {/* Search */}
            <View style={styles.webSearchWrap}>
              <Ionicons name="search-outline" size={18} color="#94A2C4" />
              <TextInput
                value={webSearch}
                onChangeText={setWebSearch}
                placeholder="Search events, artists, experiences"
                placeholderTextColor="#8F9CBC"
                style={styles.webSearchInput}
              />
            </View>

            {/* Category chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.webCategoryChipsRow}>
              {WEB_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setWebCategoryFilter(cat)}
                  style={[styles.webCategoryChip, webCategoryFilter === cat && styles.webCategoryChipActive]}
                >
                  {webCategoryFilter === cat && (
                    <LinearGradient
                      colors={['#0081C8', '#EE334E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
                    />
                  )}
                  <Text style={[styles.webCategoryChipText, webCategoryFilter === cat && styles.webCategoryChipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Auto-cycling hero carousel */}
            <WebHeroCarousel events={webHeroEvents} />

            {/* Event rails */}
            {webNearYou.length > 0 && (
              <WebRailSection
                title={`In ${state.city}`}
                subtitle={`Events happening in ${state.city}${state.country ? `, ${state.country}` : ''}`}
                events={categoryFilteredEvents(webNearYou)}
                onSeeAll={() => router.push('/(tabs)/explore')}
              />
            )}
            <WebRailSection
              title={isAuthenticated ? 'Recommended for You' : 'Featured Events'}
              subtitle={isAuthenticated && (state.interests ?? []).length > 0 ? `Based on your interests: ${(state.interests ?? []).slice(0, 3).join(', ')}` : 'Popular picks this week'}
              events={categoryFilteredEvents(webForYou)}
              onSeeAll={() => router.push('/allevents')}
            />
            <WebRailSection
              title="Activities Near You"
              subtitle="Workshops, food and wellness"
              events={categoryFilteredEvents(webActivities.length > 0 ? webActivities : webFeatured)}
              onSeeAll={() => router.push('/(tabs)/explore')}
            />
            <WebRailSection
              title="Artists Performing"
              subtitle="Live acts and cultural performances"
              events={categoryFilteredEvents(webArtists.length > 0 ? webArtists : webFeatured)}
              onSeeAll={() => router.push('/(tabs)/explore')}
            />
            <WebRailSection
              title="Upcoming Festivals"
              subtitle="Plan your next month"
              events={categoryFilteredEvents(webUpcoming)}
              onSeeAll={() => router.push('/(tabs)/calendar')}
            />
          </ScrollView>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={[styles.topBar, Platform.OS === 'web' && { maxWidth: 900, alignSelf: 'center', width: '100%' }]}>
        <LocationPicker />
        <View style={styles.topBarRight}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/search')} testID="search-btn" accessibilityLabel="Search">
            <Ionicons name="search" size={24} color={Colors.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/map' as any)} testID="map-btn" accessibilityLabel="Events Map">
            <Ionicons name="map-outline" size={24} color={Colors.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')} testID="notifications-btn" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingBottom: 120 },
          Platform.OS === 'web' && { maxWidth: 900, alignSelf: 'center', width: '100%' },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.tint}
          />
        }
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroSubtitle}>{timeGreeting}, {firstName}</Text>
          <Text style={styles.heroTitle}>
            What&apos;s happening in{'\n'}your culture this week?
          </Text>
        </View>

        {land && (
          <View style={styles.landBanner}>
            <LinearGradient
              colors={['rgba(139,69,19,0.15)', 'rgba(139,69,19,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.landBannerContent}>
              <Ionicons name="earth" size={14} color="#D4A574" />
              <Text style={styles.landBannerTitle}>You are on {land.landName}</Text>
            </View>
            <Text style={styles.landBannerSub}>Traditional Custodians: {land.traditionalCustodians}</Text>
          </View>
        )}

        <View style={styles.quickChipRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipScroll}
            style={{ flexGrow: 0 }}
          >
            {superAppSections.map((sec) => (
              <FilterChip
                key={sec.id}
                item={{ id: sec.id, label: sec.label, icon: sec.icon, color: sec.color }}
                isActive={false}
                onPress={() => router.push(SECTION_ROUTES[sec.id] as any)}
              />
            ))}
          </ScrollView>
        </View>

        {discoverLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.tint} />
            <Text style={styles.loadingText}>Personalising your feed...</Text>
          </View>
        )}

        {featuredEvent && (
          <View style={{ marginBottom: 28}}>
            <View style={{ paddingHorizontal: 16 }}>
              <SectionHeader title="Cultural Highlight " subtitle="Don't miss this week" />
            </View>
            <EventCard event={featuredEvent} highlight index={0} />
          </View>
        )}

        {popularEvents.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <SectionHeader
                title="Popular Near You"
                onSeeAll={() => router.push('/(tabs)/explore')}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              decelerationRate="fast"
              snapToInterval={254}
              snapToAlignment="start"
            >
              {popularEvents.map((event, i: number) => (
                <EventCard key={(event as unknown as EventData).id} event={event as unknown as EventData} index={i} />
              ))}
            </ScrollView>
          </View>
        )}

        {allCommunities.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>
              <SectionHeader
                title="Cultural Communities"
                subtitle={isAuthenticated ? "Your communities" : "Join a community"}
                onSeeAll={() => router.push('/(tabs)/communities')}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              decelerationRate="fast"
              snapToInterval={210}
              snapToAlignment="start"
            >
              {[...allCommunities].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0)).slice(0, 10).map((c, i: number) => (
                <CommunityCard key={c.id} community={c} index={i} />
              ))}
            </ScrollView>
          </View>
        )}

        {spotlights.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>
              <SectionHeader title="First Nations Spotlight" subtitle="Celebrating Indigenous culture" />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              decelerationRate="fast"
              snapToInterval={294}
              snapToAlignment="start"
            >
              {spotlights.map((item: any, i: number) => (
                <SpotlightCard key={item.id} item={item} index={i} />
              ))}
            </ScrollView>
          </View>
        )}

        {cultureCards.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>
              <SectionHeader title="Explore Your Culture" />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              decelerationRate="fast"
              snapToInterval={122}
              snapToAlignment="start"
            >
              {cultureCards.map((item) => (
                <CategoryCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {otherSections.filter(s => s.type === 'events' || s.type === 'mixed').map((section) => (
          <View key={section.title} style={{ marginBottom: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>
              <SectionHeader title={section.title} subtitle={section.subtitle} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              decelerationRate="fast"
              snapToInterval={254}
              snapToAlignment="start"
            >
              {section.items.filter((e) => Boolean(e.venue)).slice(0, 10).map((event, i: number) => (
                <EventCard key={String((event as unknown as EventData).id)} event={event as unknown as EventData} index={i} />
              ))}
            </ScrollView>
          </View>
        ))}

        <View style={{ marginBottom: 32 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionHeader title="Browse Categories" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            decelerationRate="fast"
            snapToInterval={122}
            snapToAlignment="start"
          >
            {browseCategories.map(cat => (
              <CategoryCard
                key={cat.id}
                item={cat}
                onPress={() => router.push('/(tabs)/explore')}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ marginBottom: 32 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionHeader title="Explore Cities" subtitle="Discover culture worldwide" />
          </View>
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {FEATURED_CITIES.map((city, i) => (
              <CityCard
                key={city.name}
                city={city}
                width={cityCardWidth}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/(tabs)/explore', params: { city: city.name } });
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.bannerWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.plusBanner,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
            onPress={() => router.push('/membership/upgrade')}
          >
            <LinearGradient
              colors={['#111111', '#1A1A24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.bannerDecoration1} />
            <View style={styles.bannerDecoration2} />
            <View style={styles.plusBannerLeft}>
              <View style={styles.plusBannerIconWrap}>
                <Ionicons name="star" size={20} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.plusBannerTitle}>CulturePass <Text style={{ color: '#FFD700' }}>PRO</Text></Text>
                <Text style={styles.plusBannerSub}>2% cashback & exclusive VIP access</Text>
              </View>
            </View>
            <View style={styles.plusBannerCta}>
              <Text style={styles.plusBannerCtaText}>Explore</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.bannerWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.perksBanner,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
            onPress={() => router.push('/perks')}
          >
            <LinearGradient
              colors={['#5856D6', '#3634A3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.plusBannerLeft}>
              <View style={styles.perksBannerIconWrap}>
                <Ionicons name="gift" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.plusBannerTitle}>Perks & Benefits</Text>
                <Text style={styles.plusBannerSub}>Exclusive discounts and rewards</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        <View style={styles.bannerWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.exploreCta,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
            onPress={() => router.push('/allevents')}
          >
            <View style={styles.exploreCtaIcon}>
              <Ionicons name="compass" size={24} color="#007AFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreCtaTitle}>Explore All Events</Text>
              <Text style={styles.exploreCtaSub}>Discover what&apos;s happening near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#636366" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.backgroundSecondary,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.surfaceSecondary,
  },
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.tint,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  landBanner: {
    borderRadius: 14,
    padding: 14,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#D4A574',
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  landBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  landBannerTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#D4A574',
  },
  landBannerSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: '#8B7355',
    marginTop: 3,
    marginLeft: 20,
  },
  quickChipRow: {
    marginBottom: 24,
  },
  quickChipScroll: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#636366',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: 4,
  },
  seeAll: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.tint,
  },
  spotlightCard: {
    width: 280,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  spotlightBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,69,19,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  spotlightBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFF',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  spotlightTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
    marginBottom: 4,
  },
  spotlightDesc: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
  },
  bannerWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  plusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    overflow: 'hidden',
    ...Colors.shadows.large,
  },
  bannerDecoration1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  bannerDecoration2: {
    position: 'absolute',
    bottom: -30,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  plusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  plusBannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  plusBannerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
  },
  plusBannerSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  plusBannerCta: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  plusBannerCtaText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#000',
  },
  perksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    overflow: 'hidden',
    ...Colors.shadows.large,
  },
  perksBannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    ...Colors.shadows.medium,
  },
  exploreCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreCtaTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  exploreCtaSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#636366',
    marginTop: 2,
  },
  webScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 120,
    gap: 28,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },
  webTopRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  webLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  webLocationText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: '#C7D2EE',
  },
  webGreeting: {
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    color: '#E8EEFA',
  },
  webHeading: {
    marginTop: 6,
    fontSize: 34,
    lineHeight: 42,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    maxWidth: 560,
  },
  webTopActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    alignItems: 'center',
  },
  webIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  webAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0081C8',
    overflow: 'hidden',
  },
  webAvatarText: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  webSearchWrap: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  webSearchInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  webCategoryChipsRow: {
    gap: 8,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  webCategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  webCategoryChipActive: {
    borderColor: 'transparent',
  },
  webCategoryChipText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.55)',
  },
  webCategoryChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
  },
  webHeroCarousel: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#12151F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  webHeroCatBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  webHeroCatBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  webHeroArrowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  webHeroArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  webHeroCarouselMeta: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 48,
  },
  webHeroCarouselTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  webHeroCarouselSub: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  webHeroCarouselCta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  webHeroCarouselCtaText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#0A0B14',
  },
  webHeroDots: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  webHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  webHeroDotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },
  webSection: {
    gap: 16,
  },
  webSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  webSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  webSectionAccentBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
  },
  webSectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#EAEEFF',
    letterSpacing: -0.3,
  },
  webSectionSub: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#7A88AA',
  },
  webSeeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  webSeeAllText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
  webRailScroll: {
    gap: 14,
    paddingBottom: 2,
  },
  webRailCard: {
    width: 250,
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12151F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  webRailImage: {
    width: '100%',
    height: '100%',
  },
  webRailDateChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#A78BFA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  webRailDateChipText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  webRailCatTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    maxWidth: 100,
  },
  webRailCatText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
  },
  webRailMeta: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 4,
  },
  webRailTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
  },
  webRailVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  webRailVenue: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.65)',
    flex: 1,
  },
  webRailBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  webRailPricePill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  webRailPriceText: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
  },
});
