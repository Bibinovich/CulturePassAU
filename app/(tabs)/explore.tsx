import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import BrowsePage, { BrowseItem, CategoryFilter } from '@/components/BrowsePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { api } from '@/lib/api';
import type { EventData } from '@/shared/schema';
import { Colors } from '@/constants/theme';

const eventCategories: CategoryFilter[] = [
  { label: 'All', icon: 'calendar', color: Colors.text },
  { label: 'Music', icon: 'musical-notes', color: Colors.error },
  { label: 'Dance', icon: 'body', color: Colors.secondary },
  { label: 'Food', icon: 'restaurant', color: Colors.warning },
  { label: 'Art', icon: 'color-palette', color: Colors.primary },
  { label: 'Wellness', icon: 'heart', color: Colors.error },
  { label: 'Film', icon: 'film', color: Colors.info },
  { label: 'Workshop', icon: 'construct', color: Colors.accent },
  { label: 'Heritage', icon: 'library', color: Colors.gold },
];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function ExploreScreen() {
  const { state } = useOnboarding();
  const params = useLocalSearchParams<{ city?: string }>();

  const activeCity = params.city || state.city;

  const { data: events = [], isLoading } = useQuery<EventData[]>({
    queryKey: ['/api/events', state.country, activeCity],
    queryFn: async () => {
      const data = await api.events.list({ city: activeCity, country: state.country, pageSize: 50 });
      return data.events ?? [];
    },
  });

  const browseItems: BrowseItem[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    subtitle: `${formatDate(event.date)} | ${event.venue}`,
    description: event.description,
    imageUrl: event.imageUrl,
    rating: event.attending ? undefined : undefined,
    priceLabel: event.priceCents === 0 ? 'Free' : event.priceLabel,
    isPromoted: event.isFeatured,
    badge: event.communityTag,
    category: event.category,
    meta: `${event.attending} attending`,
  }));

  const promotedItems = browseItems.filter((item) => item.isPromoted);

  const handleItemPress = (item: BrowseItem) => {
    router.push({ pathname: '/event/[id]', params: { id: item.id } });
  };

  return (
    <ErrorBoundary>
      <BrowsePage
        title={params.city ? `Events in ${params.city}` : "Events"}
        accentColor={Colors.primary}
        accentIcon="calendar"
        categories={eventCategories}
        categoryKey="category"
        items={browseItems}
        isLoading={isLoading}
        promotedItems={promotedItems}
        promotedTitle="Featured Events"
        onItemPress={handleItemPress}
        emptyMessage="No events found"
        emptyIcon="calendar-outline"
      />
    </ErrorBoundary>
  );
}
