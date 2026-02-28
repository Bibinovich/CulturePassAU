import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Platform, Alert, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth';
import { useRole } from '@/hooks/useRole';
import { LinearGradient } from 'expo-linear-gradient';

const isWeb = Platform.OS === 'web';

interface SettingItem {
  icon: string;
  label: string;
  sub?: string;
  color: string;
  route?: string;
  action?: () => void;
  rightText?: string;
  badge?: string;
}
interface SettingSection {
  title: string;
  items: SettingItem[];
}

const TIER_COLORS: Record<string, string> = {
  free: Colors.textSecondary,
  plus: Colors.info,
  elite: Colors.gold,
  premium: Colors.secondary,
  pro: Colors.primary,
  vip: Colors.gold,
  'sydney-local': Colors.success,
};

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const webTop = isWeb ? 67 : 0;
  const { user, isAuthenticated, logout } = useAuth();
  const { isOrganizer, isAdmin } = useRole();

  const tier = user?.subscriptionTier ?? 'free';
  const tierColor = TIER_COLORS[tier] ?? Colors.primary;
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  const navigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout('/(onboarding)');
        },
      },
    ]);
  };

  const AUTHENTICATED_SECTIONS: SettingSection[] = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', sub: 'Name, bio, photo, social links', color: Colors.primary, route: '/profile/edit' },
        { icon: 'lock-closed-outline', label: 'Privacy & Security', sub: 'Profile visibility, data sharing', color: Colors.secondary, route: '/settings/privacy' },
        { icon: 'notifications-outline', label: 'Notifications', sub: 'Push, email, event reminders', color: Colors.accent, route: '/settings/notifications' },
        { icon: 'location-outline', label: 'Location & City', sub: 'Update your city and country', color: Colors.success, route: '/(onboarding)/location' },
      ],
    },
    {
      title: 'Membership & Payments',
      items: [
        { icon: 'star-outline', label: 'My Membership', sub: `${tierLabel} Plan · Tap to upgrade`, color: Colors.gold, route: '/membership/upgrade' },
        { icon: 'wallet-outline', label: 'Wallet & Balance', sub: 'Top up, view cashback', color: Colors.success, route: '/payment/wallet' },
        { icon: 'card-outline', label: 'Payment Methods', sub: 'Cards, bank accounts', color: Colors.primary, route: '/payment/methods' },
        { icon: 'receipt-outline', label: 'Transaction History', sub: 'Purchases and payments', color: Colors.textSecondary, route: '/payment/transactions' },
      ],
    },
    {
      title: 'My Content',
      items: [
        { icon: 'ticket-outline', label: 'My Tickets', sub: 'Upcoming and past events', color: Colors.secondary, route: '/tickets' },
        { icon: 'bookmark-outline', label: 'Saved Items', sub: 'Events, perks, businesses', color: Colors.accent, route: '/saved' },
        { icon: 'people-outline', label: 'My Communities', sub: 'Groups you\'ve joined', color: Colors.success, route: '/(tabs)/communities' },
      ],
    },
    ...(isOrganizer ? [{
      title: 'Organizer Tools',
      items: [
        { icon: 'grid-outline', label: 'Organizer Dashboard', sub: 'Manage your events and tickets', color: Colors.primary, route: '/dashboard/organizer' },
        { icon: 'qr-code-outline', label: 'Ticket Scanner', sub: 'Scan attendee tickets at gate', color: Colors.secondary, route: '/scanner' },
        { icon: 'add-circle-outline', label: 'Submit Content', sub: 'Events, businesses, listings', color: Colors.accent, route: '/submit' },
        ...(isAdmin ? [{ icon: 'people-outline', label: 'Admin Panel', sub: 'Manage users and roles', color: Colors.error, route: '/admin/users' }] : []),
      ] as SettingItem[],
    }] : []),
    {
      title: 'Help & Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help Center', sub: 'FAQs, guides, tutorials', color: Colors.info, route: '/help' },
        { icon: 'mail-outline', label: 'Contact Us', sub: 'support@culturepass.au', color: Colors.success, action: () => Linking.openURL('mailto:support@culturepass.au?subject=CulturePass%20Support') },
        { icon: 'flag-outline', label: 'Report a Problem', sub: 'Something not working?', color: Colors.warning, action: () => Linking.openURL('mailto:bugs@culturepass.au?subject=Bug%20Report%20-%20CulturePass') },
        { icon: 'star-half-outline', label: 'Rate CulturePass', sub: 'Share your feedback', color: Colors.accent, action: () => Linking.openURL(Platform.OS === 'android' ? 'market://details?id=au.culturepass.app' : 'https://apps.apple.com/app/culturepass/id6742686059') },
      ],
    },
    {
      title: 'Legal',
      items: [
        { icon: 'shield-checkmark-outline', label: 'Privacy Policy', color: Colors.info, route: '/legal/privacy' },
        { icon: 'document-text-outline', label: 'Terms of Service', color: Colors.secondary, route: '/legal/terms' },
        { icon: 'finger-print-outline', label: 'Cookie Policy', color: Colors.accent, route: '/legal/cookies' },
        { icon: 'people-circle-outline', label: 'Community Guidelines', color: Colors.success, route: '/legal/guidelines' },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'information-circle-outline', label: 'About CulturePass', color: Colors.primary, route: '/settings/about' },
        { icon: 'phone-portrait-outline', label: 'App Version', rightText: '1.0.0 (1)', color: Colors.textSecondary },
      ],
    },
  ];

  const GUEST_SECTIONS: SettingSection[] = [
    {
      title: 'Help & Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help Center', sub: 'FAQs, guides, tutorials', color: Colors.info, route: '/help' },
        { icon: 'mail-outline', label: 'Contact Us', sub: 'support@culturepass.au', color: Colors.success, action: () => Linking.openURL('mailto:support@culturepass.au?subject=CulturePass%20Support') },
      ],
    },
    {
      title: 'Legal',
      items: [
        { icon: 'shield-checkmark-outline', label: 'Privacy Policy', color: Colors.info, route: '/legal/privacy' },
        { icon: 'document-text-outline', label: 'Terms of Service', color: Colors.secondary, route: '/legal/terms' },
        { icon: 'finger-print-outline', label: 'Cookie Policy', color: Colors.accent, route: '/legal/cookies' },
        { icon: 'people-circle-outline', label: 'Community Guidelines', color: Colors.success, route: '/legal/guidelines' },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'information-circle-outline', label: 'About CulturePass', color: Colors.primary, route: '/settings/about' },
        { icon: 'phone-portrait-outline', label: 'App Version', rightText: '1.0.0 (1)', color: Colors.textSecondary },
      ],
    },
  ];

  const sections = isAuthenticated ? AUTHENTICATED_SECTIONS : GUEST_SECTIONS;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account & Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + (isWeb ? 34 : insets.bottom) }}
      >
        {/* ── Authenticated: Profile Card ── */}
        {isAuthenticated && user ? (
          <View style={styles.profileCardWrap}>
            <Pressable style={styles.profileCard} onPress={() => navigate('/profile/edit')}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.profileRow}>
                {/* Avatar */}
                <View style={styles.avatarWrap}>
                  {user.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarLetter}>
                        {(user.displayName ?? user.username ?? 'C')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
                </View>
                {/* Info */}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {user.displayName ?? user.username ?? 'CulturePass User'}
                  </Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>{user.email ?? ''}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: tierColor + '30', borderColor: tierColor + '70' }]}>
                    <Ionicons name="star" size={10} color={tierColor} />
                    <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
                  </View>
                </View>
                {/* Edit button */}
                <View style={styles.editBtn}>
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </View>
              </View>
              {/* Location row */}
              {(user.city || user.country) ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.locationText}>
                    {[user.city, user.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ) : (
          /* ── Guest: Sign In / Sign Up CTA ── */
          <View style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <Ionicons name="person-circle-outline" size={64} color={Colors.primary} />
            </View>
            <Text style={styles.guestTitle}>Welcome to CulturePass</Text>
            <Text style={styles.guestSub}>
              Sign in to access your profile, tickets, wallet, and exclusive cultural events.
            </Text>
            {/* Sign In */}
            <Pressable style={styles.guestSignInBtn} onPress={() => navigate('/(onboarding)/login')}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={styles.guestSignInText}>Sign In</Text>
            </Pressable>
            {/* Create Account */}
            <Pressable style={styles.guestSignUpBtn} onPress={() => navigate('/(onboarding)/signup')}>
              <Text style={styles.guestSignUpText}>
                Don&apos;t have an account?{' '}
                <Text style={{ color: Colors.primary, fontFamily: 'Poppins_600SemiBold' }}>
                  Create one free
                </Text>
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Settings Sections ── */}
        {sections.map((section, si) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <View key={item.label}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingRow,
                      pressed && styles.settingRowPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (item.route) navigate(item.route);
                      else item.action?.();
                    }}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingLabel}>{item.label}</Text>
                      {item.sub ? <Text style={styles.settingSub}>{item.sub}</Text> : null}
                    </View>
                    {item.rightText ? (
                      <Text style={styles.settingRightText}>{item.rightText}</Text>
                    ) : (item.route ?? item.action) ? (
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    ) : null}
                  </Pressable>
                  {ii < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign Out ── */}
        {isAuthenticated && (
          <View style={[styles.section, { marginBottom: 12 }]}>
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footerNote}>
          CulturePass AU · v1.0.0{'\n'}
          Available in Australia, New Zealand, UAE, UK & Canada
        </Text>
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

  // Profile card
  profileCardWrap: { marginHorizontal: 20, marginBottom: 8 },
  profileCard: {
    borderRadius: 20, padding: 18, overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarLetter: { fontSize: 26, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
  tierDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  profileName: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
  profileEmail: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.75)' },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  tierText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  editBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  locationText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.7)' },

  // Guest card
  guestCard: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 20,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  guestIconCircle: { marginBottom: 12 },
  guestTitle: {
    fontSize: 20, fontFamily: 'Poppins_700Bold',
    color: Colors.text, marginBottom: 8, textAlign: 'center',
  },
  guestSub: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  guestSignInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', height: 50, borderRadius: 14,
    width: '100%', overflow: 'hidden', marginBottom: 12,
  },
  guestSignInText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
  guestSignUpBtn: { paddingVertical: 4 },
  guestSignUpText: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary,
  },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 6 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  settingRowPressed: { backgroundColor: Colors.backgroundSecondary },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.text },
  settingSub: {
    fontSize: 12, fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary, marginTop: 1,
  },
  settingRightText: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 62 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 16,
    paddingVertical: 16, borderWidth: 1, borderColor: Colors.error + '30',
  },
  signOutText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.error },

  // Footer
  footerNote: {
    textAlign: 'center', fontSize: 11,
    fontFamily: 'Poppins_400Regular', color: Colors.textTertiary,
    marginTop: 12, marginBottom: 8, lineHeight: 18,
  },
});
