import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';
import { api, type MembershipSummary } from '@/lib/api';
import { Colors } from '@/constants/theme';

const PLUS_COLOR = Colors.primary;
const PLUS_ACCENT = Colors.primaryDark;
const PLUS_GRADIENT_BG = Colors.primaryGlow;

const FEATURES = [
  { icon: 'cash-outline', title: '2% Cashback', desc: 'On every ticket purchase, credited to your wallet', free: false, plus: true },
  { icon: 'time-outline', title: 'Early Access', desc: '48-hour head start on event tickets', free: false, plus: true },
  { icon: 'gift-outline', title: 'Exclusive Perks', desc: 'Members-only deals from local businesses', free: false, plus: true },
  { icon: 'shield-checkmark-outline', title: 'Plus Badge', desc: 'Stand out in the community', free: false, plus: true },
  { icon: 'calendar-outline', title: 'Event Discovery', desc: 'Browse and discover cultural events', free: true, plus: true },
  { icon: 'people-outline', title: 'Communities', desc: 'Join and engage with cultural groups', free: true, plus: true },
  { icon: 'ticket-outline', title: 'Ticket Purchases', desc: 'Buy tickets to events', free: true, plus: true },
  { icon: 'person-outline', title: 'Profile & Directory', desc: 'Create and share your profile', free: true, plus: true },
];

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? 67 : 0;
  const { userId, isAuthenticated } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  const { data: membership } = useQuery<MembershipSummary>({
    queryKey: ['membership', userId],
    queryFn: () => api.membership.get(userId!),
    enabled: !!userId,
  });

  const { data: memberCountData } = useQuery({
    queryKey: ['membership-member-count'],
    queryFn: () => api.membership.memberCount(),
  });

  const isPlus = membership?.tier === 'plus' && membership?.status === 'active';
  const memberCount = memberCountData?.count ?? 0;

  const price = billingPeriod === 'yearly' ? '$69' : '$7.99';
  const perMonth = billingPeriod === 'yearly' ? '$5.75' : '$7.99';

  const handleSubscribe = useCallback(async () => {
    if (!userId) {
      Alert.alert('Login required', 'Please sign in to activate CulturePass+.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(onboarding)/login') },
      ]);
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const data = await api.membership.subscribe({ billingPeriod });
      if (data.alreadyActive) {
        await queryClient.invalidateQueries({ queryKey: ['membership', userId] });
        Alert.alert('Already Active', 'Your CulturePass+ membership is already active.');
        return;
      }
      if (data.checkoutUrl) {
        await WebBrowser.openBrowserAsync(data.checkoutUrl);
        await queryClient.invalidateQueries({ queryKey: ['membership', userId] });
        await queryClient.invalidateQueries({ queryKey: ['membership-member-count'] });

        const pollForUpdate = async (retries = 0): Promise<void> => {
          if (retries >= 8) return;
          try {
            const checkData = await api.membership.get(userId);
            if (checkData?.tier === 'plus' && checkData?.status === 'active') {
              await queryClient.invalidateQueries({ queryKey: ['membership', userId] });
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Welcome to CulturePass+!', 'Your membership is now active. Enjoy early access, cashback rewards, and exclusive perks!');
              return;
            }
          } catch {}
          await new Promise(r => setTimeout(r, 2000));
          return pollForUpdate(retries + 1);
        };
        await pollForUpdate();
      } else if (data.devMode) {
        // Local dev: instant upgrade without Stripe
        await queryClient.invalidateQueries({ queryKey: ['membership', userId] });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Dev Mode', 'Membership upgraded to Plus (dev mode — no Stripe charge).');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start subscription';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [userId, billingPeriod]);

  const handleCancel = useCallback(async () => {
    if (!userId) return;
    Alert.alert(
      'Cancel Membership',
      'Are you sure you want to cancel your CulturePass+ membership? Your subscription will be cancelled immediately and you will lose access to exclusive perks and cashback.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Membership',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.membership.cancel();
              await queryClient.invalidateQueries({ queryKey: ['membership', userId] });
              await queryClient.invalidateQueries({ queryKey: ['membership-member-count'] });
              queryClient.setQueryData(['membership', userId], {
                tier: 'free',
                tierLabel: 'Free',
                status: 'inactive',
                expiresAt: null,
                cashbackRate: 0,
                cashbackMultiplier: 1,
                earlyAccessHours: 0,
                eventsAttended: membership?.eventsAttended ?? 0,
              } satisfies MembershipSummary);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Membership Cancelled', 'Your CulturePass+ membership has been cancelled. You can re-subscribe anytime.');
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Failed to cancel';
              Alert.alert('Error', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [userId]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTop, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Ionicons name="lock-closed-outline" size={42} color={Colors.textSecondary} />
        <Text style={[styles.headerTitle, { marginTop: 14 }]}>Sign In Required</Text>
        <Text style={[styles.heroDesc, { textAlign: 'center', marginTop: 8 }]}>
          Sign in to activate and manage your CulturePass+ membership.
        </Text>
        <Pressable style={[styles.subscribeBtn, { marginTop: 20, width: '100%' }]} onPress={() => router.push('/(onboarding)/login')}>
          <Text style={styles.subscribeBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>CulturePass+</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="globe" size={40} color={PLUS_ACCENT} />
          </View>
          <Text style={styles.heroTitle}>CulturePass+</Text>
          <Text style={styles.heroTagline}>Access. Advantage. Influence.</Text>
          <Text style={styles.heroDesc}>
            Unlock premium cultural experiences with cashback rewards, early access to events, and exclusive perks from local businesses.
          </Text>
        </View>

        {memberCount > 0 && (
          <View style={styles.socialProof}>
            <Ionicons name="people" size={16} color={PLUS_ACCENT} />
            <Text style={styles.socialProofText}>
              Join {memberCount.toLocaleString()}+ members already enjoying CulturePass+
            </Text>
          </View>
        )}

        {!isPlus && (
          <View style={styles.pricingSection}>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, billingPeriod === 'monthly' && styles.toggleActive]}
                onPress={() => setBillingPeriod('monthly')}
              >
                <Text style={[styles.toggleText, billingPeriod === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, billingPeriod === 'yearly' && styles.toggleActive]}
                onPress={() => setBillingPeriod('yearly')}
              >
                <Text style={[styles.toggleText, billingPeriod === 'yearly' && styles.toggleTextActive]}>Yearly</Text>
                {billingPeriod === 'yearly' && <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>-28%</Text></View>}
              </Pressable>
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.priceAmount}>{price}</Text>
              <Text style={styles.pricePeriod}>
                {billingPeriod === 'yearly' ? '/year' : '/month'}
              </Text>
              {billingPeriod === 'yearly' && (
                <Text style={styles.priceBreakdown}>That&apos;s just {perMonth}/month</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.comparisonSection}>
          <Text style={styles.sectionTitle}>What&apos;s Included</Text>

          <View style={styles.comparisonHeader}>
            <View style={{ flex: 1 }} />
            <View style={styles.compColHeader}>
              <Text style={styles.compColLabel}>Free</Text>
            </View>
            <View style={[styles.compColHeader, styles.compColPlus]}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={[styles.compColLabel, { color: '#fff' }]}> Plus</Text>
            </View>
          </View>

          {FEATURES.map((f, i) => (
            <View key={f.title} style={styles.compRow}>
              <View style={styles.compFeature}>
                <Ionicons name={f.icon as any} size={18} color={PLUS_COLOR} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.compFeatureTitle}>{f.title}</Text>
                  <Text style={styles.compFeatureDesc}>{f.desc}</Text>
                </View>
              </View>
              <View style={styles.compCheck}>
                {f.free ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                ) : (
                  <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                )}
              </View>
              <View style={[styles.compCheck, styles.compCheckPlus]}>
                <Ionicons name="checkmark-circle" size={20} color={PLUS_COLOR} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.highlightsSection}>
          <View style={styles.highlightCard}>
            <View style={[styles.highlightIcon, { backgroundColor: '#34C75915' }]}>
              <Ionicons name="cash" size={24} color="#34C759" />
            </View>
            <Text style={styles.highlightTitle}>2% Cashback</Text>
            <Text style={styles.highlightDesc}>Every ticket purchase earns you cashback, automatically credited to your wallet.</Text>
          </View>
          <View style={styles.highlightCard}>
            <View style={[styles.highlightIcon, { backgroundColor: '#007AFF15' }]}>
              <Ionicons name="flash" size={24} color="#007AFF" />
            </View>
            <Text style={styles.highlightTitle}>48h Early Access</Text>
            <Text style={styles.highlightDesc}>Get a 48-hour head start on hot event tickets before they go on sale to everyone.</Text>
          </View>
          <View style={styles.highlightCard}>
            <View style={[styles.highlightIcon, { backgroundColor: '#FF9F0A15' }]}>
              <Ionicons name="gift" size={24} color="#FF9F0A" />
            </View>
            <Text style={styles.highlightTitle}>Exclusive Perks</Text>
            <Text style={styles.highlightDesc}>Access members-only deals and discounts from restaurants, shops, and cultural venues.</Text>
          </View>
        </View>

        {isPlus ? (
          <View style={styles.activeSection}>
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.activeText}>You&apos;re a CulturePass+ member</Text>
            </View>
            <Text style={styles.activeSubtext}>Thank you for being part of the CulturePass+ community.</Text>
            <Pressable style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel Membership</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.ctaSection}>
            <Pressable
              style={[styles.subscribeBtn, loading && styles.subscribeBtnDisabled]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.subscribeBtnText}>Get CulturePass+ for {price}{billingPeriod === 'yearly' ? '/yr' : '/mo'}</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.ctaFine}>Cancel anytime. Powered by Stripe.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: PLUS_COLOR },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  heroSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 8 },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PLUS_GRADIENT_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: PLUS_COLOR, marginBottom: 4 },
  heroTagline: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: PLUS_ACCENT, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  heroDesc: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },

  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLUS_GRADIENT_BG,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'center',
  },
  socialProofText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: PLUS_COLOR, marginLeft: 6 },

  pricingSection: { marginTop: 24 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  toggleTextActive: { color: PLUS_COLOR, fontFamily: 'Poppins_600SemiBold' },
  saveBadge: { backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  saveBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#fff' },

  priceCard: { alignItems: 'center', paddingVertical: 16 },
  priceAmount: { fontSize: 44, fontFamily: 'Poppins_700Bold', color: PLUS_COLOR },
  pricePeriod: { fontSize: 16, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary, marginTop: 2 },
  priceBreakdown: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: PLUS_ACCENT, marginTop: 6 },

  sectionTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 16 },
  comparisonSection: { marginTop: 8, marginBottom: 20 },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingRight: 4 },
  compColHeader: { width: 52, alignItems: 'center', paddingVertical: 4 },
  compColPlus: { backgroundColor: PLUS_COLOR, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 6 },
  compColLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.textTertiary },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  compFeature: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  compFeatureTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  compFeatureDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 1 },
  compCheck: { width: 52, alignItems: 'center' },
  compCheckPlus: {},

  highlightsSection: { marginBottom: 20, gap: 12 },
  highlightCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    ...Colors.shadows.small,
  },
  highlightIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  highlightTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 4 },
  highlightDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, lineHeight: 19 },

  activeSection: { alignItems: 'center', paddingVertical: 24 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 12,
  },
  activeText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.success, marginLeft: 8 },
  activeSubtext: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginBottom: 20 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.error },

  ctaSection: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLUS_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    ...Colors.shadows.medium,
  },
  subscribeBtnDisabled: { opacity: 0.6 },
  subscribeBtnText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },
  ctaFine: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 10 },
});
