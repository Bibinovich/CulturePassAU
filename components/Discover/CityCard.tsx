import { View, Text, Pressable, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import { useState } from 'react';

const CITY_IMAGES: Record<string, string> = {
  'Sydney': 'https://images.pexels.com/photos/995764/pexels-photo-995764.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Melbourne': 'https://images.pexels.com/photos/302827/pexels-photo-302827.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Brisbane': 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Auckland': 'https://images.pexels.com/photos/315793/pexels-photo-315793.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Dubai': 'https://images.pexels.com/photos/3787839/pexels-photo-3787839.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'London': 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Toronto': 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Vancouver': 'https://images.pexels.com/photos/2087391/pexels-photo-2087391.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const CITY_FALLBACK_IMAGES: Record<string, string> = {
  'Toronto': 'https://images.pexels.com/photos/1781629/pexels-photo-1781629.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Vancouver': 'https://images.pexels.com/photos/264112/pexels-photo-264112.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2566242/pexels-photo-2566242.jpeg?auto=compress&cs=tinysrgb&w=1200';

interface CityCardProps {
  city: {
    name: string;
    country: string;
    imageUrl?: string;
  };
  onPress?: () => void;
  width?: number;
}

export default function CityCard({ city, onPress, width }: CityCardProps) {
  const cityPrimaryImage = city.imageUrl || CITY_IMAGES[city.name] || FALLBACK_IMAGE;
  const cityFallbackImage = CITY_FALLBACK_IMAGES[city.name];
  const [imageUri, setImageUri] = useState(cityPrimaryImage);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        width ? { width } : null,
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        Platform.OS === 'web' && { cursor: 'pointer' as any },
        Colors.shadows.medium,
      ]}
      onPress={onPress}
      accessibilityLabel={`Explore ${city.name}, ${city.country}`}
    >
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        onError={() => {
          if (cityFallbackImage && imageUri !== cityFallbackImage && imageUri !== FALLBACK_IMAGE) {
            setImageUri(cityFallbackImage);
            return;
          }
          if (imageUri !== FALLBACK_IMAGE) setImageUri(FALLBACK_IMAGE);
        }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        <Text style={styles.cityName}>{city.name}</Text>
        <Text style={styles.country}>{city.country}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  cityName: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
  },
  country: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
});
