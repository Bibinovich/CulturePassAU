import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Ticket, User } from '@/shared/schema';
import { Colors } from '@/constants/theme';

type TicketPrintLayout = 'full' | 'badge';

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return 'TBA';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PrintableBadge({ ticket, attendeeName }: { ticket: Ticket; attendeeName: string }) {
  return (
    <View style={styles.badgeWrap}>
      <View style={styles.badgeHole} />
      <View style={styles.badgeCard}>
        <View style={[styles.badgeTop, { backgroundColor: ticket.imageColor ?? Colors.primary }]}>
          <Text style={styles.badgeBrand}>CulturePass</Text>
          <Text style={styles.badgeEvent} numberOfLines={1}>{ticket.eventTitle ?? ticket.eventName ?? 'Event Ticket'}</Text>
        </View>
        <View style={styles.badgeBody}>
          <Text style={styles.badgeName}>{attendeeName}</Text>
          <Text style={styles.badgeMeta}>{formatEventDate(ticket.eventDate ?? ticket.date)}</Text>
          {ticket.eventVenue ? <Text style={styles.badgeMeta} numberOfLines={1}>{ticket.eventVenue}</Text> : null}
          <View style={styles.badgeBottom}>
            <View style={styles.badgeCodePill}>
              <Ionicons name="qr-code-outline" size={12} color={Colors.primary} />
              <Text style={styles.badgeCode}>{ticket.ticketCode ?? ticket.qrCode ?? 'TICKET'}</Text>
            </View>
            <Text style={styles.badgeQty}>x{ticket.quantity ?? 1}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PrintableFull({ ticket, attendeeName }: { ticket: Ticket; attendeeName: string }) {
  return (
    <View style={styles.fullCard}>
      <View style={[styles.fullHeader, { backgroundColor: ticket.imageColor ?? Colors.primary }]}>
        <Text style={styles.fullHeaderTitle}>CulturePass Event Ticket</Text>
      </View>
      <View style={styles.fullBody}>
        <Text style={styles.fullEvent}>{ticket.eventTitle ?? ticket.eventName ?? 'Event Ticket'}</Text>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Attendee</Text>
          <Text style={styles.fullValue}>{attendeeName}</Text>
        </View>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Date</Text>
          <Text style={styles.fullValue}>{formatEventDate(ticket.eventDate ?? ticket.date)}</Text>
        </View>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Time</Text>
          <Text style={styles.fullValue}>{ticket.eventTime ?? 'TBA'}</Text>
        </View>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Venue</Text>
          <Text style={styles.fullValue}>{ticket.eventVenue ?? 'TBA'}</Text>
        </View>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Tier</Text>
          <Text style={styles.fullValue}>{ticket.tierName ?? 'General'}</Text>
        </View>
        <View style={styles.fullRow}>
          <Text style={styles.fullLabel}>Ticket Code</Text>
          <Text style={styles.fullCode}>{ticket.ticketCode ?? ticket.qrCode ?? 'TICKET'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TicketPrintScreen() {
  const params = useLocalSearchParams<{ id?: string; layout?: string; autoPrint?: string }>();
  const ticketId = String(params.id ?? '');
  const [layout, setLayout] = useState<TicketPrintLayout>(params.layout === 'badge' ? 'badge' : 'full');

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ['ticket', ticketId, 'print'],
    queryFn: () => api.tickets.get(ticketId),
    enabled: Boolean(ticketId),
  });

  const { data: attendee } = useQuery<User>({
    queryKey: ['ticket', ticketId, 'attendee', ticket?.userId ?? ''],
    queryFn: () => api.users.get(String(ticket?.userId)),
    enabled: Boolean(ticket?.userId),
  });

  const attendeeName = useMemo(
    () => attendee?.displayName ?? attendee?.username ?? 'CulturePass Guest',
    [attendee?.displayName, attendee?.username]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (params.autoPrint !== '1') return;
    if (!ticket) return;
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [params.autoPrint, ticket]);

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return;
    }
    Alert.alert('Print', 'Printing is available on web. Open this ticket on web to print.');
  };

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerText}>Loading printable ticket...</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="ticket-outline" size={36} color={Colors.textSecondary} />
        <Text style={styles.centerText}>Ticket not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={styles.toolbarBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
          <Text style={styles.toolbarBtnText}>Back</Text>
        </Pressable>
        <View style={styles.switchRow}>
          <Pressable
            style={[styles.switchBtn, layout === 'full' && styles.switchBtnActive]}
            onPress={() => setLayout('full')}
          >
            <Text style={[styles.switchText, layout === 'full' && styles.switchTextActive]}>Full Ticket</Text>
          </Pressable>
          <Pressable
            style={[styles.switchBtn, layout === 'badge' && styles.switchBtnActive]}
            onPress={() => setLayout('badge')}
          >
            <Text style={[styles.switchText, layout === 'badge' && styles.switchTextActive]}>Badge / Lanyard</Text>
          </Pressable>
        </View>
        <Pressable style={styles.toolbarPrimary} onPress={handlePrint}>
          <Ionicons name="print-outline" size={16} color="#FFF" />
          <Text style={styles.toolbarPrimaryText}>Print</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.printArea}>
        {layout === 'badge' ? (
          <PrintableBadge ticket={ticket} attendeeName={attendeeName} />
        ) : (
          <PrintableFull ticket={ticket} attendeeName={attendeeName} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  toolbar: {
    paddingTop: Platform.OS === 'web' ? 12 : 18,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E6EF',
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolbarBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  toolbarPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolbarPrimaryText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FFF' },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF3FA',
    borderRadius: 10,
    padding: 3,
    flex: 1,
    maxWidth: 320,
  },
  switchBtn: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  switchBtnActive: { backgroundColor: '#FFF' },
  switchText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  switchTextActive: { color: Colors.text, fontFamily: 'Poppins_600SemiBold' },
  printArea: { padding: 24, alignItems: 'center' },

  fullCard: {
    width: 720,
    maxWidth: '100%',
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E6ECF5',
    overflow: 'hidden',
  },
  fullHeader: { paddingHorizontal: 24, paddingVertical: 16 },
  fullHeaderTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  fullBody: { padding: 22, gap: 10 },
  fullEvent: { fontSize: 23, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 4 },
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
    paddingBottom: 8,
  },
  fullLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  fullValue: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text, maxWidth: '65%', textAlign: 'right' },
  fullCode: { fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: 1, color: Colors.primary },

  badgeWrap: { alignItems: 'center', marginTop: 8 },
  badgeHole: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#CFD6E3',
    marginBottom: -15,
    zIndex: 2,
    borderWidth: 8,
    borderColor: '#F5F7FB',
  },
  badgeCard: {
    width: 340,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E7F2',
    backgroundColor: '#FFF',
  },
  badgeTop: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  badgeBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Poppins_500Medium' },
  badgeEvent: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold', marginTop: 2 },
  badgeBody: { paddingHorizontal: 16, paddingVertical: 14 },
  badgeName: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text },
  badgeMeta: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary, marginTop: 4 },
  badgeBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeCode: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: Colors.primary, letterSpacing: 0.6 },
  badgeQty: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },

  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  centerText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.primary + '12', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  backBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
});
