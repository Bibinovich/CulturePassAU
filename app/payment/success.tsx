import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

export default function PaymentSuccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
        <Ionicons name="checkmark-circle" size={80} color={colors.success} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]}>Payment Successful</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your ticket is confirmed. Check your email for a receipt.
        </Text>
      </View>

      <View style={styles.actions}>
        {ticketId ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace(`/tickets/${ticketId}`);
            }}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>View Ticket</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/(tabs)');
          }}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 32,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
