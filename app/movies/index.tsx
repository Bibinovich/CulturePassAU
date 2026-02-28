import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { api } from '@/lib/api';
import BrowsePage, { BrowseItem, CategoryFilter } from '@/components/BrowsePage';
const movieGenres: CategoryFilter[] = [
  { label: 'All', icon: 'film', color: '#1C1C1E' },
  { label: 'Action', icon: 'flash', color: '#E85D3A' },
  { label: 'Drama', icon: 'heart', color: '#9B59B6' },
  { label: 'Comedy', icon: 'happy', color: '#F2A93B' },
  { label: 'Horror', icon: 'skull', color: '#2C3E50' },
  { label: 'Thriller', icon: 'eye', color: '#E74C3C' },
  { label: 'Romance', icon: 'heart-circle', color: '#E91E63' },
];

interface MovieData {
  id: string;
  title: string;
  language: string;
  duration: string;
  rating: string;
  posterUrl: string;
  imdbScore: number;
  showtimes: { price: number }[];
  genre: string[];
  isPromoted: boolean;
}

export default function MoviesScreen() {
  const { state } = useOnboarding();

  const { data: moviesData = [], isLoading } = useQuery({
    queryKey: ['/api/movies', state.country, state.city],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (state.country) params['country'] = state.country;
      if (state.city) params['city'] = state.city;
      return api.movies.list(params);
    },
  });

  // Map API data to BrowseItem format
  const items: BrowseItem[] = (moviesData as unknown as MovieData[]).map((movie) => ({
    id: movie.id,
    title: movie.title,
    subtitle: `${movie.language} | ${movie.duration} | ${movie.rating}`,
    imageUrl: movie.posterUrl,
    rating: movie.imdbScore,
    priceLabel: `From $${movie.showtimes[0]?.price}`,
    badge: movie.genre?.join(', '),
    isPromoted: movie.isPromoted,
    genre: movie.genre, // For filtering by category
  }));

  // Filter promoted items
  const promotedItems = items.filter(item => item.isPromoted);

  const handleItemPress = (item: BrowseItem) => {
    router.push({ pathname: '/movies/[id]', params: { id: item.id } });
  };

  return (
    <BrowsePage
      title="Movies"
      accentColor="#9B59B6"
      accentIcon="film"
      categories={movieGenres}
      categoryKey="genre"
      items={items}
      isLoading={isLoading}
      promotedItems={promotedItems}
      promotedTitle="Now Trending"
      onItemPress={handleItemPress}
    />
  );
}
