import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';
import { useLayout } from '@/hooks/useLayout';
import { useRole } from '@/hooks/useRole';
import { Colors } from '@/constants/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { EventData } from '@/shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrganizerStats {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalTicketsSold: number;
  totalRevenueCents: number;
}

interface EventsResponse {
  events: EventData[];
  total?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusColor(status?: string): string {
  switch (status) {
    case 'published': return Colors.success;
    case 'draft': return Colors.warning ?? '#F59E0B';
    case 'deleted': return Colors.error;
    default: return Colors.textTertiary;
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'published': return 'Live';
    case 'draft': return 'Draft';
    case 'deleted': return 'Deleted';
    default: return status ?? 'Unknown';
  }
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={[styles.statIcon, { backgroundColor: accent + '20' }]}>
        <Ionicons name={icon as never} size={20} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Event Row
// ---------------------------------------------------------------------------

function EventRow({
  event,
  onPublish,
  onDelete,
  isPublishing,
  isDeleting,
}: {
  event: EventData;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  isPublishing: boolean;
  isDeleting: boolean;
}) {
  const colors = useColors();
  const status = (event as EventData & { status?: string }).status;
  const accentColor = statusColor(status);

  return (
    <View style={[styles.eventRow, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Pressable
        style={styles.eventRowContent}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      >
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: accentColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.statusText, { color: accentColor }]}>{statusLabel(status)}</Text>
        </View>

        <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
          {formatDate(event.date)} · {event.venue ?? '—'}
        </Text>

        <View style={styles.eventFooter}>
          <View style={styles.eventStats}>
            <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.eventStatText, { color: colors.textTertiary }]}>
              {event.attending ?? 0}/{event.capacity ?? '∞'}
            </Text>
          </View>
          <Text style={[styles.eventPrice, { color: colors.primary }]}>
            {event.isFree ? 'Free' : event.priceLabel ?? formatCurrency(event.priceCents ?? 0)}
          </Text>
        </View>
      </Pressable>

      {/* Action buttons — only for non-deleted events */}
      {status !== 'deleted' && (
        <View style={styles.eventActions}>
          {status === 'draft' && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Colors.success + '20' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPublish(event.id);
              }}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size={12} color={Colors.success} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={14} color={Colors.success} />
              )}
              <Text style={[styles.actionBtnText, { color: Colors.success }]}>Publish</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: Colors.error + '20' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDelete(event.id);
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size={12} color={Colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={14} color={Colors.error} />
            )}
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

function OrganizerDashboardContent() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { hPad } = useLayout();
  const { userId, user } = useAuth();
  const { isOrganizer, isLoading: roleLoading } = useRole();

  useEffect(() => {
    if (!roleLoading && !isOrganizer) {
      router.replace('/(tabs)');
    }
  }, [isOrganizer, roleLoading]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // My events
  const {
    data: eventsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<EventsResponse>({
    queryKey: ['/api/events', { organizerId: userId }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/events?organizerId=${userId}&page=1&pageSize=50`);
      return res.json();
    },
    enabled: !!userId,
  });

  const events: EventData[] = eventsData?.events ?? [];

  // Compute stats locally from event data
  const stats: OrganizerStats = {
    totalEvents: events.length,
    publishedEvents: events.filter((e) => (e as EventData & { status?: string }).status === 'published').length,
    draftEvents: events.filter((e) => (e as EventData & { status?: string }).status === 'draft').length,
    totalTicketsSold: events.reduce((sum, e) => sum + (e.attending ?? 0), 0),
    totalRevenueCents: events.reduce(
      (sum, e) => sum + (e.priceCents ?? 0) * (e.attending ?? 0),
      0
    ),
  };

  // Publish event
  const publishMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest('POST', `/api/events/${eventId}/publish`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', { organizerId: userId }] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // Delete (soft) event
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest('DELETE', `/api/events/${eventId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', { organizerId: userId }] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  function handleDelete(eventId: string) {
    Alert.alert(
      'Delete Event',
      'Are you sure? This will soft-delete the event and hide it from all users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(eventId),
        },
      ]
    );
  }

  const sortedEvents = [...events].sort((a, b) => {
    // Draft first, then published, then deleted
    const order = { draft: 0, published: 1, deleted: 2 };
    const sa = (a as EventData & { status?: string }).status ?? 'published';
    const sb = (b as EventData & { status?: string }).status ?? 'published';
    return (order[sa as keyof typeof order] ?? 1) - (order[sb as keyof typeof order] ?? 1);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, paddingHorizontal: hPad, backgroundColor: colors.surface, borderBottomColor: colors.cardBorder }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Organizer Dashboard</Text>
          {user?.displayName && (
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{user.displayName}</Text>
          )}
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/submit');
          }}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: hPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/submit');
            }}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Create Event</Text>
          </Pressable>

          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.secondary ?? Colors.secondary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/scanner');
            }}
          >
            <Ionicons name="qr-code-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Scan Tickets</Text>
          </Pressable>

          <Pressable
            style={[styles.quickAction, { backgroundColor: Colors.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/tickets');
            }}
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>All Tickets</Text>
          </Pressable>
        </View>

        {/* Stats Row */}
        {!isLoading && (
          <View style={styles.statsRow}>
            <StatCard
              label="Total Events"
              value={String(stats.totalEvents)}
              icon="calendar"
              accent={Colors.primary}
            />
            <StatCard
              label="Published"
              value={String(stats.publishedEvents)}
              icon="radio-button-on"
              accent={Colors.success}
            />
            <StatCard
              label="Attending"
              value={String(stats.totalTicketsSold)}
              icon="people"
              accent={Colors.info ?? '#3498DB'}
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(stats.totalRevenueCents)}
              icon="wallet"
              accent={Colors.gold ?? Colors.accent}
            />
          </View>
        )}

        {/* Events Section */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Events</Text>
            {stats.draftEvents > 0 && (
              <View style={[styles.draftBadge, { backgroundColor: Colors.warning + '20' }]}>
                <Text style={[styles.draftBadgeText, { color: Colors.warning ?? '#F59E0B' }]}>
                  {stats.draftEvents} draft{stats.draftEvents > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading your events…
              </Text>
            </View>
          ) : sortedEvents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No events yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create your first event to get started.
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/submit')}
              >
                <Text style={styles.emptyBtnText}>Create Event</Text>
              </Pressable>
            </View>
          ) : (
            sortedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onPublish={(id) => publishMutation.mutate(id)}
                onDelete={handleDelete}
                isPublishing={publishMutation.isPending && publishMutation.variables === event.id}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === event.id}
              />
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}

export default function OrganizerDashboard() {
  return (
    <ErrorBoundary>
      <OrganizerDashboardContent />
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 1 },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingTop: 16, gap: 16 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  quickActionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  draftBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  draftBadgeText: { fontSize: 12, fontWeight: '600' },
  eventRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 10,
  },
  eventRowContent: { padding: 14, gap: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  eventMeta: { fontSize: 13 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  eventStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventStatText: { fontSize: 12 },
  eventPrice: { fontSize: 13, fontWeight: '600' },
  eventActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    padding: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  loadingContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
