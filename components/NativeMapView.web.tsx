import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/hooks/useColors';
import { useLayout } from '@/hooks/useLayout';
import { Spacing, TextStyles } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NativeMapViewWeb() {
  const colors = useColors();
  const { isDesktop } = useLayout();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Card
        glass
        shadow="large"
        style={[
          styles.card,
          {
            borderColor: colors.border,
            maxWidth: isDesktop ? 680 : 520,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="map-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Interactive Map on Mobile</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}> 
          Use iOS or Android for full marker interactions and location-aware discovery. 
          Web currently shows the optimized city/event list experience.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TextStyles.title3,
    textAlign: 'center',
  },
  text: {
    ...TextStyles.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
