import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Platform, Linking, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState, useMemo } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

const isWeb = Platform.OS === 'web';

interface FaqItem { q: string; a: string; }
interface FaqCategory { id: string; label: string; icon: string; color: string; items: FaqItem[]; }

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'start',
    label: 'Getting Started',
    icon: 'rocket-outline',
    color: Colors.primary,
    items: [
      { q: 'What is CulturePass?', a: 'CulturePass is a lifestyle and community platform for cultural diaspora communities across Australia, New Zealand, UAE, UK, and Canada. It helps you discover local cultural events, join communities, access exclusive perks, and connect with people who share your heritage.' },
      { q: 'How do I create an account?', a: 'Tap "Create Account" on the welcome screen. Enter your email and a password (min 6 characters), then follow the steps to set your location and interests. You can also sign in with Google on web.' },
      { q: 'Is CulturePass free to use?', a: 'Yes! The Free tier gives you access to browse events, join communities, and use the basic features. Upgrade to Plus or Elite for exclusive perks, early ticket access, and premium benefits.' },
      { q: 'Which countries are supported?', a: 'CulturePass is currently live in Australia, New Zealand, UAE, United Kingdom, and Canada. We\'re expanding to more countries soon — follow our social channels for updates.' },
      { q: 'Can I use CulturePass without an account?', a: 'You can browse the app as a guest, but purchasing tickets, joining communities, saving events, and accessing perks all require a free account.' },
    ],
  },
  {
    id: 'account',
    label: 'Account & Profile',
    icon: 'person-circle-outline',
    color: Colors.secondary,
    items: [
      { q: 'How do I edit my profile?', a: 'Go to Settings → Edit Profile (or tap your avatar on the Profile tab). You can update your display name, bio, profile photo, city, social links, and interests.' },
      { q: 'How do I change my password?', a: 'Go to Settings → Privacy & Security → Change Password. You\'ll receive a reset link at your registered email address.' },
      { q: 'How do I change my location / city?', a: 'Go to Settings → Location & City. You can select a new country and city, and your discover feed will update to show local events.' },
      { q: 'How do I delete my account?', a: 'Go to Settings → Privacy & Security → scroll to the bottom → Delete Account. This action is permanent and removes all your data, tickets, and wallet balance.' },
      { q: 'Can I use Google to sign in?', a: 'Google sign-in is available on the web app. Native mobile Google sign-in is coming soon. For now, use email and password on iOS and Android.' },
      { q: 'What is my CulturePass ID?', a: 'Your CulturePass ID (CP-XXXXX) is a unique identifier shown on your profile. Use it to share your profile, find friends, and check in at events via QR scan.' },
    ],
  },
  {
    id: 'events',
    label: 'Events & Tickets',
    icon: 'ticket-outline',
    color: Colors.accent,
    items: [
      { q: 'How do I buy tickets?', a: 'Browse events on the Discover or Explore tab. Tap an event → select your ticket tier → choose your payment method (Wallet or saved card) → confirm. Your ticket QR code will appear in My Tickets.' },
      { q: 'Where do I find my tickets?', a: 'Go to Settings → My Tickets, or tap the Tickets section on your Profile tab. Tickets show your QR code for event check-in.' },
      { q: 'Can I get a refund?', a: 'If an event is cancelled by the organiser, you receive a full refund to your CulturePass Wallet within 3–5 business days. For self-cancellations, the refund policy varies per event and is shown at checkout.' },
      { q: 'How does QR check-in work?', a: 'Each ticket has a unique QR code. At the event venue, show your QR code to the organiser or scan it yourself at a self-service terminal. Tickets are validated instantly.' },
      { q: 'Can I transfer tickets to a friend?', a: 'Ticket transfers are coming soon. Currently, you can share the QR code, but the ticket remains linked to your account.' },
    ],
  },
  {
    id: 'membership',
    label: 'Membership & Perks',
    icon: 'star-outline',
    color: Colors.gold,
    items: [
      { q: 'What membership tiers are available?', a: 'CulturePass offers Free, Plus (~$4.99/mo), and Elite (~$9.99/mo) tiers. Higher tiers unlock early ticket access, exclusive perks, VIP upgrades, and cashback on purchases.' },
      { q: 'How do I upgrade my membership?', a: 'Go to Settings → My Membership → tap Upgrade. Choose your plan and complete payment. Your benefits activate immediately.' },
      { q: 'How do I cancel my membership?', a: 'Go to Settings → My Membership → Cancel Subscription. Your benefits continue until the end of the current billing period.' },
      { q: 'What are Perks?', a: 'Perks are exclusive discounts, free tickets, early access, and VIP upgrades from CulturePass and partner brands. Visit the Perks tab to browse and redeem available offers for your tier.' },
      { q: 'How does the Wallet work?', a: 'Your Wallet is a digital balance you can top up with any payment method. Use it to buy tickets fast with no extra steps. Cashback from eligible purchases is added to your Wallet automatically.' },
      { q: 'Do perks expire?', a: 'Yes — each perk has an expiry date shown on the perk card. Redeem before the expiry date. Expired perks are removed from your account automatically.' },
    ],
  },
  {
    id: 'technical',
    label: 'Technical Issues',
    icon: 'build-outline',
    color: Colors.info,
    items: [
      { q: 'The app is showing a white / blank screen', a: 'Try force-closing the app and reopening. On web, try clearing your browser cache (Ctrl+Shift+R / Cmd+Shift+R). If the issue persists, try logging out and back in.' },
      { q: 'I can\'t sign in — what should I do?', a: 'Check you\'re using the correct email and password. Try "Forgot Password" to reset. Make sure you have a stable internet connection. If issues continue, email support@culturepass.au.' },
      { q: 'My payment failed', a: 'Check your card details and that your card has sufficient funds. Some cards require 3D Secure verification — check for an SMS or bank app prompt. Try a different payment method or contact your bank.' },
      { q: 'Notifications are not working', a: 'Go to Settings → Notifications to check your preferences. On iOS/Android, also check your device notification permissions for CulturePass in your phone\'s Settings app.' },
      { q: 'The app is slow or crashing', a: 'Ensure you have the latest version of the app. Try restarting your device. If issues persist, please report via "Report a Problem" with details of what you were doing.' },
      { q: 'I found a bug — how do I report it?', a: 'Use the "Report a Problem" option in Settings → Help & Support, or email bugs@culturepass.au with a description, your device model, OS version, and screenshots if possible.' },
    ],
  },
];

const CONTACT_OPTIONS = [
  { icon: 'mail', label: 'Email Support', sub: 'support@culturepass.au', color: Colors.primary, action: () => Linking.openURL('mailto:support@culturepass.au') },
  { icon: 'call', label: 'Phone Support', sub: '1800 285 887 (Mon–Fri 9am–6pm AEST)', color: Colors.success, action: () => Linking.openURL('tel:1800285887') },
  { icon: 'chatbubbles', label: 'Live Chat', sub: 'Available 9am–6pm AEST on weekdays', color: Colors.info, action: () => Linking.openURL('mailto:support@culturepass.au?subject=Live%20Chat%20Request&body=Hi%20CulturePass%20team%2C%20I%20need%20help%20with...') },
  { icon: 'logo-twitter', label: 'Twitter / X', sub: '@CulturePassApp', color: '#1DA1F2', action: () => Linking.openURL('https://twitter.com/CulturePassApp') },
];

const QUICK_LINKS = [
  { icon: 'ticket-outline', label: 'My Tickets', route: '/tickets', color: Colors.secondary },
  { icon: 'wallet-outline', label: 'Wallet', route: '/payment/wallet', color: Colors.success },
  { icon: 'star-outline', label: 'Membership', route: '/membership/upgrade', color: Colors.gold },
  { icon: 'shield-checkmark-outline', label: 'Privacy', route: '/legal/privacy', color: Colors.info },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const webTop = isWeb ? 67 : 0;

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) {
      return activeCategory
        ? FAQ_CATEGORIES.filter(c => c.id === activeCategory)
        : FAQ_CATEGORIES;
    }
    const q = search.toLowerCase();
    return FAQ_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(
        item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.items.length > 0);
  }, [search, activeCategory]);

  const totalResults = filteredCategories.reduce((n, c) => n + c.items.length, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + (isWeb ? 34 : insets.bottom) }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <Animated.View entering={isWeb ? undefined : FadeInDown.delay(60).duration(400)} style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy" size={32} color="#FFF" />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSub}>
            Find answers to common questions or reach out to our support team.
          </Text>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={isWeb ? undefined : FadeInDown.delay(120).duration(400)} style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help articles…"
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        {/* Quick Links */}
        {!search && (
          <Animated.View entering={isWeb ? undefined : FadeInDown.delay(160).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Links</Text>
            <View style={styles.quickRow}>
              {QUICK_LINKS.map(ql => (
                <Pressable
                  key={ql.label}
                  style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(ql.route as any);
                  }}
                >
                  <View style={[styles.quickIcon, { backgroundColor: ql.color + '18' }]}>
                    <Ionicons name={ql.icon as any} size={22} color={ql.color} />
                  </View>
                  <Text style={styles.quickLabel}>{ql.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Category Filter Pills */}
        {!search && (
          <Animated.View entering={isWeb ? undefined : FadeInDown.delay(200).duration(400)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsRow}
            >
              <Pressable
                style={[styles.pill, activeCategory === null && styles.pillActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory(null); }}
              >
                <Text style={[styles.pillText, activeCategory === null && styles.pillTextActive]}>All</Text>
              </Pressable>
              {FAQ_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.pill, activeCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveCategory(activeCategory === cat.id ? null : cat.id);
                  }}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={activeCategory === cat.id ? '#FFFFFF' : Colors.textSecondary}
                  />
                  <Text style={[styles.pillText, activeCategory === cat.id && styles.pillTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* FAQ Sections */}
        {search.trim() && totalResults === 0 ? (
          <View style={styles.emptySearch}>
            <Ionicons name="search" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No results for &ldquo;{search}&rdquo;</Text>
            <Text style={styles.emptySub}>Try different keywords or browse the categories above.</Text>
          </View>
        ) : (
          filteredCategories.map((cat, ci) => (
            <Animated.View
              key={cat.id}
              entering={isWeb ? undefined : FadeInDown.delay(240 + ci * 50).duration(400)}
              style={styles.section}
            >
              <View style={styles.catHeader}>
                <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                </View>
                <Text style={styles.sectionTitle}>{cat.label}</Text>
                <Text style={styles.catCount}>{cat.items.length}</Text>
              </View>
              {cat.items.map((faq, fi) => {
                const key = `${cat.id}-${fi}`;
                const isOpen = expandedFaq === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setExpandedFaq(isOpen ? null : key);
                    }}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={isOpen ? Colors.primary : Colors.textSecondary}
                      />
                    </View>
                    {isOpen && (
                      <Text style={styles.faqAnswer}>{faq.a}</Text>
                    )}
                  </Pressable>
                );
              })}
            </Animated.View>
          ))
        )}

        {/* Contact Us */}
        <Animated.View entering={isWeb ? undefined : FadeInDown.delay(400).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactCard}>
            {CONTACT_OPTIONS.map((opt, i) => (
              <View key={opt.label}>
                <Pressable
                  style={({ pressed }) => [styles.contactItem, pressed && { backgroundColor: Colors.backgroundSecondary }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); opt.action(); }}
                >
                  <View style={[styles.contactIcon, { backgroundColor: opt.color + '15' }]}>
                    <Ionicons name={opt.icon as any} size={20} color={opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactLabel}>{opt.label}</Text>
                    <Text style={styles.contactSub}>{opt.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </Pressable>
                {i < CONTACT_OPTIONS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Legal */}
        <Animated.View entering={isWeb ? undefined : FadeInDown.delay(460).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.contactCard}>
            {[
              { label: 'Privacy Policy', icon: 'shield-checkmark-outline', color: Colors.info, route: '/legal/privacy' },
              { label: 'Terms of Service', icon: 'document-text-outline', color: Colors.secondary, route: '/legal/terms' },
              { label: 'Cookie Policy', icon: 'finger-print-outline', color: Colors.accent, route: '/legal/cookies' },
              { label: 'Community Guidelines', icon: 'people-circle-outline', color: Colors.success, route: '/legal/guidelines' },
            ].map((item, i, arr) => (
              <View key={item.label}>
                <Pressable
                  style={({ pressed }) => [styles.contactItem, pressed && { backgroundColor: Colors.backgroundSecondary }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
                >
                  <View style={[styles.contactIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.contactLabel, { flex: 1 }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </Pressable>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={isWeb ? undefined : FadeInDown.delay(520).duration(400)} style={styles.aboutSection}>
          <View style={styles.aboutLogo}>
            <Ionicons name="globe" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.aboutName}>CulturePass</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutTagline}>Your one-stop lifestyle platform for cultural diaspora communities</Text>
          <Text style={styles.aboutCountries}>Available in Australia · New Zealand · UAE · UK · Canada</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },

  // Hero
  heroCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.primary, borderRadius: 20,
    padding: 24, alignItems: 'center',
  },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#FFF', marginBottom: 6 },
  heroSub: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 19,
  },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1, fontSize: 15,
    fontFamily: 'Poppins_400Regular', color: Colors.text,
  },

  // Quick links
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.text, textAlign: 'center' },

  // Category pills
  pillsRow: { paddingHorizontal: 20, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  pillTextActive: { color: '#FFFFFF' },

  // Section
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 10 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catCount: {
    marginLeft: 'auto', fontSize: 12,
    fontFamily: 'Poppins_500Medium', color: Colors.textTertiary,
  },

  // FAQ
  faqCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 8,
  },
  faqCardOpen: { borderColor: Colors.primary + '40', backgroundColor: Colors.primarySoft },
  faqHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 12,
  },
  faqQuestion: {
    fontSize: 14, fontFamily: 'Poppins_600SemiBold',
    color: Colors.text, flex: 1, lineHeight: 20,
  },
  faqAnswer: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary, marginTop: 10, lineHeight: 20,
  },

  // Empty search
  emptySearch: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 16, fontFamily: 'Poppins_600SemiBold',
    color: Colors.text, marginTop: 12, marginBottom: 6, textAlign: 'center',
  },
  emptySub: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },

  // Contact
  contactCard: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.text },
  contactSub: {
    fontSize: 12, fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary, marginTop: 1,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 66 },

  // About
  aboutSection: {
    alignItems: 'center', paddingHorizontal: 40,
    paddingVertical: 20, marginBottom: 8,
  },
  aboutLogo: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  aboutName: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text },
  aboutVersion: {
    fontSize: 12, fontFamily: 'Poppins_400Regular',
    color: Colors.textTertiary, marginBottom: 8,
  },
  aboutTagline: {
    fontSize: 13, fontFamily: 'Poppins_500Medium',
    color: Colors.textSecondary, textAlign: 'center', marginBottom: 4,
  },
  aboutCountries: {
    fontSize: 11, fontFamily: 'Poppins_400Regular',
    color: Colors.textTertiary, textAlign: 'center',
  },
});
