import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/auth';
import { api, type MembershipSummary, type RewardsSummary } from '@/lib/api';
import type { Ticket as ApiTicket } from '@/shared/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletTicket {
  id: string;
  eventTitle: string;
  eventDate: string | null;
  eventTime: string | null;
  eventVenue: string | null;
  tierName: string | null;
  quantity: number | null;
  status: ApiTicket['status'];
  imageColor: string | null;
  price?: number | null;
}

function toWalletTicket(ticket: ApiTicket): WalletTicket {
  return {
    id: ticket.id,
    eventTitle: ticket.eventTitle ?? ticket.eventName ?? ticket.title ?? 'Untitled Event',
    eventDate: ticket.eventDate ?? ticket.date ?? null,
    eventTime: ticket.eventTime ?? null,
    eventVenue: ticket.eventVenue ?? ticket.venue ?? null,
    tierName: ticket.tierName ?? null,
    quantity: ticket.quantity ?? null,
    status: ticket.status ?? null,
    imageColor: ticket.imageColor ?? null,
    price: ticket.totalPriceCents != null ? ticket.totalPriceCents / 100 : null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  const isThisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return true;
  return new Date(dateStr) >= new Date();
}

const TIER_CONFIG: Record<string, { label: string; colors: [string, string]; icon: string }> = {
  free: { label: 'Standard', colors: ['#636e72', '#2d3436'], icon: 'shield-outline' },
  plus: { label: 'Plus', colors: ['#3498DB', '#1A5276'], icon: 'star' },
  premium: { label: 'Premium', colors: ['#F39C12', '#8E5C00'], icon: 'diamond' },
  elite: { label: 'Elite', colors: ['#8E44AD', '#4A235A'], icon: 'trophy' },
  vip: { label: 'VIP', colors: ['#E74C3C', '#922B21'], icon: 'ribbon' },
  pro: { label: 'Pro', colors: ['#27AE60', '#1A6B3C'], icon: 'briefcase' },
};

// ─── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, index }: { ticket: WalletTicket; index: number }) {
  const accentColor = ticket.imageColor || Colors.primary;
  const upcoming = isUpcoming(ticket.eventDate);

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(350)}>
      <Pressable
        style={[styles.ticketCard, { borderLeftColor: accentColor, borderLeftWidth: 4 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/tickets/[id]', params: { id: ticket.id } });
        }}
      >
        {/* Status dot */}
        <View style={[styles.ticketStatusDot, { backgroundColor: upcoming ? Colors.success : Colors.textTertiary }]} />

        <View style={{ flex: 1 }}>
          <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.eventTitle}</Text>
          <View style={styles.ticketMeta}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.ticketMetaText}>{formatEventDate(ticket.eventDate)}</Text>
            {ticket.eventTime && (
              <>
                <Text style={styles.ticketMetaDot}>·</Text>
                <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.ticketMetaText}>{ticket.eventTime}</Text>
              </>
            )}
          </View>
          {ticket.eventVenue && (
            <View style={styles.ticketMeta}>
              <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.ticketMetaText} numberOfLines={1}>{ticket.eventVenue}</Text>
            </View>
          )}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {ticket.tierName && (
            <View style={[styles.tierPill, { backgroundColor: accentColor + '20' }]}>
              <Text style={[styles.tierPillText, { color: accentColor }]}>{ticket.tierName}</Text>
            </View>
          )}
          {ticket.quantity && ticket.quantity > 1 && (
            <Text style={styles.quantityText}>×{ticket.quantity}</Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatBox({ value, label, icon }: { value: string | number; label: string; icon: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon as any} size={18} color={Colors.primary} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type WalletTab = 'upcoming' | 'past';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { userId, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<WalletTab>('upcoming');

  const { data: ticketsData = [], isLoading } = useQuery<WalletTicket[]>({
    queryKey: ['tickets', 'wallet', userId],
    queryFn: async () => {
      const tickets = await api.tickets.forUser(userId!);
      return Array.isArray(tickets) ? tickets.map(toWalletTicket) : [];
    },
    enabled: !!userId,
  });

  const { data: membership } = useQuery<MembershipSummary>({
    queryKey: ['membership', userId],
    queryFn: () => api.membership.get(userId!),
    enabled: !!userId,
  });
  const { data: rewards } = useQuery<RewardsSummary>({
    queryKey: ['rewards', userId],
    queryFn: () => api.rewards.get(userId!),
    enabled: !!userId,
  });

  if (!isAuthenticated || !userId) {
    return (
      <View style={[styles.container, { paddingTop: topInset, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Ionicons name="lock-closed-outline" size={42} color={Colors.textSecondary} />
        <Text style={[styles.headerTitle, { marginTop: 14 }]}>Sign In Required</Text>
        <Text style={[styles.emptySubtitle, { textAlign: 'center', marginTop: 6 }]}>
          Sign in to access your ticket wallet and CulturePass+ benefits.
        </Text>
        <Pressable style={[styles.upgradePrompt, { marginTop: 16 }]} onPress={() => router.push('/(onboarding)/login')}>
          <Text style={styles.upgradePromptText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const confirmed = ticketsData.filter((t) => t.status === 'confirmed' || t.status === 'used');
  const upcoming = confirmed.filter((t) => isUpcoming(t.eventDate));
  const past = confirmed.filter((t) => !isUpcoming(t.eventDate));

  const tierConfig = TIER_CONFIG[membership?.tier || 'free'] ?? TIER_CONFIG.free;
  const displayTickets = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <Pressable
          style={styles.scanBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/tickets/index');
          }}
        >
          <Ionicons name="ticket-outline" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>

        {/* Membership card */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.membershipCardWrap}>
          <LinearGradient
            colors={tierConfig.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.membershipCard}
          >
            {/* Decorative circle */}
            <View style={styles.membershipCircle} />
            <View style={styles.membershipCircle2} />

            <View style={styles.membershipTop}>
              <View>
                <Text style={styles.membershipLabel}>CulturePass</Text>
                <Text style={styles.membershipTier}>{tierConfig.label}</Text>
              </View>
              <View style={styles.membershipIconWrap}>
                <Ionicons name={tierConfig.icon as any} size={28} color="rgba(255,255,255,0.9)" />
              </View>
            </View>

            <View style={styles.membershipBottom}>
              <View>
                <Text style={styles.membershipStatLabel}>Total Events</Text>
                <Text style={styles.membershipStatValue}>{membership?.eventsAttended ?? confirmed.length}</Text>
              </View>
              {membership?.cashbackMultiplier && membership.cashbackMultiplier > 1 && (
                <View>
                  <Text style={styles.membershipStatLabel}>Cashback</Text>
                  <Text style={styles.membershipStatValue}>{((membership.cashbackMultiplier - 1) * 100).toFixed(0)}%</Text>
                </View>
              )}
              {membership?.expiresAt && (
                <View>
                  <Text style={styles.membershipStatLabel}>Expires</Text>
                  <Text style={styles.membershipStatValue}>
                    {new Date(membership.expiresAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(400)} style={styles.rewardsStrip}>
          <View style={styles.rewardsLeft}>
            <View style={styles.rewardsIconWrap}>
              <Ionicons name="trophy-outline" size={15} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.rewardsTitle}>
                {rewards?.tierLabel ?? 'Silver'} Rewards
              </Text>
              <Text style={styles.rewardsSub}>
                {rewards?.nextTierLabel
                  ? `${rewards.pointsToNextTier} pts to ${rewards.nextTierLabel}`
                  : 'Top tier unlocked'}
              </Text>
            </View>
          </View>
          <Text style={styles.rewardsPoints}>{rewards?.points ?? 0} pts</Text>
        </Animated.View>

        {/* Upgrade prompt for free tier */}
        {(!membership || membership.tier === 'free') && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable
              style={styles.upgradePrompt}
              onPress={() => router.push('/membership/upgrade')}
            >
              <Ionicons name="star" size={16} color="#F39C12" />
              <Text style={styles.upgradePromptText}>
                Upgrade to Plus for 2% cashback on all tickets
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#F39C12" />
            </Pressable>
          </Animated.View>
        )}

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          <StatBox value={upcoming.length} label="Upcoming" icon="calendar" />
          <View style={styles.statsDivider} />
          <StatBox value={past.length} label="Attended" icon="checkmark-circle" />
          <View style={styles.statsDivider} />
          <StatBox value={confirmed.length} label="Total" icon="ticket" />
        </Animated.View>

        {/* Apple/Google Wallet promo */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.digitalWalletRow}>
          <Pressable
            style={[styles.walletPassBtn, { backgroundColor: '#1C1C1E' }]}
            onPress={() => Alert.alert('Coming Soon', 'Apple Wallet integration coming soon!')}
          >
            <Ionicons name="logo-apple" size={18} color="#FFF" />
            <Text style={styles.walletPassText}>Add to Apple Wallet</Text>
          </Pressable>
          <Pressable
            style={[styles.walletPassBtn, { backgroundColor: '#4285F4' }]}
            onPress={() => Alert.alert('Coming Soon', 'Google Wallet integration coming soon!')}
          >
            <Ionicons name="logo-google" size={16} color="#FFF" />
            <Text style={styles.walletPassText}>Google Wallet</Text>
          </Pressable>
        </Animated.View>

        {/* Tabs */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.tabsRow}>
          <Pressable
            style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab('upcoming'); }}
          >
            <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
              Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'past' && styles.tabActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab('past'); }}
          >
            <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
              Past {past.length > 0 && `(${past.length})`}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Ticket list */}
        <View style={styles.ticketList}>
          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptySubtitle}>Loading tickets...</Text>
            </View>
          ) : displayTickets.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyState}>
              <Ionicons
                name={tab === 'upcoming' ? 'ticket-outline' : 'time-outline'}
                size={48}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>
                {tab === 'upcoming' ? 'No upcoming tickets' : 'No past events'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'upcoming'
                  ? 'Browse events and grab your first ticket!'
                  : 'Your attended events will appear here.'}
              </Text>
              {tab === 'upcoming' && (
                <Pressable
                  style={styles.browseBtn}
                  onPress={() => router.push('/(tabs)')}
                >
                  <Text style={styles.browseBtnText}>Discover Events</Text>
                </Pressable>
              )}
            </Animated.View>
          ) : (
            displayTickets.map((ticket: WalletTicket, index: number) => (
              <TicketCard key={ticket.id} ticket={ticket} index={index} />
            ))
          )}
        </View>

        {/* View all link */}
        {displayTickets.length > 0 && (
          <Pressable
            style={styles.viewAllBtn}
            onPress={() => router.push('/tickets/index')}
          >
            <Text style={styles.viewAllBtnText}>View All Tickets</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  scanBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Membership card
  membershipCardWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    ...Colors.shadow.medium,
  },
  membershipCard: {
    padding: 22,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 140,
  },
  membershipCircle: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  membershipCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  membershipTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  membershipLabel: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  membershipTier: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
    marginTop: 2,
  },
  membershipIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipBottom: {
    flexDirection: 'row',
    gap: 32,
  },
  membershipStatLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)',
  },
  membershipStatValue: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
    marginTop: 1,
  },

  rewardsStrip: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Colors.shadow.small,
  },
  rewardsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rewardsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.warning + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
  },
  rewardsSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  rewardsPoints: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: Colors.warning,
  },

  // Upgrade prompt
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FEF9E7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F9E79F',
  },
  upgradePromptText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: '#7D6608',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    ...Colors.shadow.small,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },

  // Digital wallet
  digitalWalletRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  walletPassBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  walletPassText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFF',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary,
  },
  tabTextActive: { color: '#FFF' },

  // Ticket list
  ticketList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    ...Colors.shadow.small,
  },
  ticketStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  ticketTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ticketMetaText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
  },
  ticketMetaDot: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierPillText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  quantityText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  browseBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFF',
  },

  // View all
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    marginTop: 8,
  },
  viewAllBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
});
