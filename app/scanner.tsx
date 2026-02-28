import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import * as Haptics from 'expo-haptics';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useContacts } from '@/contexts/ContactsContext';
import { api } from '@/lib/api';
import { useRole } from '@/hooks/useRole';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';

type ScanMode = 'tickets' | 'culturepass';

type TicketScanResult = {
  valid: boolean;
  message: string;
  outcome?: 'accepted' | 'duplicate' | 'rejected';
  ticket?: {
    id: string;
    eventTitle: string;
    eventDate: string | null;
    eventTime: string | null;
    eventVenue: string | null;
    tierName: string | null;
    quantity: number | null;
    totalPriceCents: number | null;
    status: string | null;
    ticketCode: string | null;
    scannedAt: string | null;
    userId?: string | null;
  };
};

type CulturePassContact = {
  cpid: string;
  name: string;
  username?: string;
  tier?: string;
  org?: string;
  avatarUrl?: string;
  city?: string;
  country?: string;
  bio?: string;
  userId?: string;
};

// ─── Staff session stats ────────────────────────────────────────────────────
type SessionStats = {
  accepted: number;
  duplicates: number;
  rejected: number;
  startedAt: Date;
};

const INITIAL_STATS: SessionStats = {
  accepted: 0,
  duplicates: 0,
  rejected: 0,
  startedAt: new Date(),
};

function parseVCard(data: string): CulturePassContact | null {
  const lines = data.split(/\r?\n/);
  let name = '', org = '', cpid = '';
  for (const line of lines) {
    if (line.startsWith('FN:')) name = line.substring(3).trim();
    else if (line.startsWith('ORG:')) org = line.substring(4).trim();
    else if (line.startsWith('NOTE:')) {
      const m = line.substring(5).trim().match(/CP-\w+/);
      if (m) cpid = m[0];
    }
  }
  if (!name && !cpid) return null;
  return { cpid: cpid || 'Unknown', name: name || 'Unknown', org };
}

function parseCulturePassInput(input: string): CulturePassContact | null {
  const t = input.trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t);
      if (j.type === 'culturepass_id') {
        return { cpid: j.cpid || j.id || '', name: j.name || j.displayName || '', username: j.username || '', tier: j.tier || 'free' };
      }
    } catch {}
  }
  if (t.startsWith('BEGIN:VCARD')) return parseVCard(t);
  if (/^CP-\w+$/i.test(t)) return { cpid: t.toUpperCase(), name: '' };
  return null;
}

const TIER_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  free: { label: 'Free', color: Colors.textSecondary, icon: 'shield-outline' },
  plus: { label: 'Plus', color: '#3498DB', icon: 'star' },
  premium: { label: 'Premium', color: '#F39C12', icon: 'diamond' },
  vip: { label: 'VIP', color: '#8E44AD', icon: 'diamond' },
};

// ─── Outcome colour helpers ──────────────────────────────────────────────────
const OUTCOME_CONFIG = {
  accepted: { color: '#34C759', bg: '#34C75910', icon: 'checkmark-circle' as const, title: 'Ticket Valid' },
  duplicate: { color: '#FF9500', bg: '#FF950010', icon: 'warning' as const, title: 'Already Scanned' },
  rejected: { color: '#FF3B30', bg: '#FF3B3010', icon: 'close-circle' as const, title: 'Invalid Ticket' },
};

function getOutcomeConfig(result: TicketScanResult) {
  if (result.valid) return OUTCOME_CONFIG.accepted;
  const msg = result.message.toLowerCase();
  if (msg.includes('used') || msg.includes('duplicate') || msg.includes('already')) return OUTCOME_CONFIG.duplicate;
  return OUTCOME_CONFIG.rejected;
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { isOrganizer, isLoading: roleLoading } = useRole();

  useEffect(() => {
    if (!roleLoading && !isOrganizer) {
      router.replace('/(tabs)');
    }
  }, [isOrganizer, roleLoading]);

  const [mode, setMode] = useState<ScanMode>('culturepass');

  // ── Ticket scanning state ──────────────────────────────────────────────────
  const [ticketCode, setTicketCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [ticketResult, setTicketResult] = useState<TicketScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<TicketScanResult[]>([]);
  const [ticketCameraActive, setTicketCameraActive] = useState(false);
  const [session, setSession] = useState<SessionStats>({ ...INITIAL_STATS, startedAt: new Date() });
  const ticketLastScanned = useRef('');

  // ── CulturePass contact state ──────────────────────────────────────────────
  const [cpInput, setCpInput] = useState('');
  const [cpContact, setCpContact] = useState<CulturePassContact | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [cpCameraActive, setCpCameraActive] = useState(false);
  const cpLastScanned = useRef('');

  const [permission, requestPermission] = useCameraPermissions();
  const { addContact, isContactSaved } = useContacts();

  // Reset ticket camera guard when result is cleared
  useEffect(() => {
    if (!ticketResult) ticketLastScanned.current = '';
  }, [ticketResult]);

  // ── Camera permission helper ──────────────────────────────────────────────
  const ensureCameraPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera scanning works best on a physical device. Use manual input on web.');
      return false;
    }
    if (permission?.granted) return true;
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert('Camera Permission', 'Camera access is required to scan QR codes. Please enable it in your device settings.');
      return false;
    }
    return true;
  }, [permission, requestPermission]);

  // ───────────────────────────────────────────────────────────────────────────
  // TICKET SCANNING
  // ───────────────────────────────────────────────────────────────────────────

  const doTicketScan = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setIsScanning(true);
    Keyboard.dismiss();

    try {
      const data = await api.tickets.scan({ ticketCode: trimmed, scannedBy: 'staff' });
      const valid = data.valid !== false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: TicketScanResult = {
        valid,
        message: data.message || (valid ? 'Ticket accepted' : 'Invalid ticket'),
        outcome: (data.outcome as TicketScanResult['outcome']) ?? (valid ? 'accepted' : 'rejected'),
        ticket: (data.ticket as any) ?? undefined,
      };

      setTicketResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 49)]);

      // Update session stats
      setSession(prev => ({
        ...prev,
        accepted: prev.accepted + (valid ? 1 : 0),
        duplicates: prev.duplicates + (!valid && result.outcome === 'duplicate' ? 1 : 0),
        rejected: prev.rejected + (!valid && result.outcome !== 'duplicate' ? 1 : 0),
      }));

      if (valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.outcome === 'duplicate') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (Platform.OS !== 'web') Vibration.vibrate([0, 100, 50, 100]);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (Platform.OS !== 'web') Vibration.vibrate([0, 300]);
      }

      setTicketCode('');
    } catch (e: any) {
      const result: TicketScanResult = { valid: false, outcome: 'rejected', message: e.message || 'Network error' };
      setTicketResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 49)]);
      setSession(prev => ({ ...prev, rejected: prev.rejected + 1 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsScanning(false);
      setTicketCameraActive(false);
    }
  }, []);

  const handleTicketBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (ticketLastScanned.current === data) return;
    ticketLastScanned.current = data;
    setTicketCameraActive(false);
    doTicketScan(data);
  }, [doTicketScan]);

  const handleManualTicketScan = useCallback(() => {
    if (!ticketCode.trim()) {
      Alert.alert('Enter Code', 'Please enter a ticket code.');
      return;
    }
    doTicketScan(ticketCode);
  }, [ticketCode, doTicketScan]);

  const startTicketCamera = useCallback(async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    setTicketResult(null);
    ticketLastScanned.current = '';
    setTicketCameraActive(true);
  }, [ensureCameraPermission]);

  const resetSession = useCallback(() => {
    Alert.alert('Reset Session', 'Clear all scan history and reset stats?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setSession({ ...INITIAL_STATS, startedAt: new Date() });
          setScanHistory([]);
          setTicketResult(null);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // CULTUREPASS CONTACT SCANNING
  // ───────────────────────────────────────────────────────────────────────────

  const lookupCpid = useCallback(async (cpid: string): Promise<CulturePassContact | null> => {
    try {
      const data = await api.cpid.lookup(cpid);
      if (data.userId || data.targetId) {
        const userId = data.userId || data.targetId!;
        const u = await api.users.get(userId);
        return { cpid, name: (u as any).displayName || (u as any).username || '', username: (u as any).username, tier: 'free', avatarUrl: (u as any).avatarUrl, city: (u as any).city, country: (u as any).country, bio: (u as any).bio, userId: (u as any).id };
      }
      return data.name ? { cpid: data.cpid, name: data.name, username: data.username, tier: data.tier, org: data.org, avatarUrl: data.avatarUrl, city: data.city, country: data.country, bio: data.bio } : null;
    } catch {
      return null;
    }
  }, []);

  const processScannedCpData = useCallback(async (input: string) => {
    if (cpLastScanned.current === input) return;
    cpLastScanned.current = input;
    const contact = parseCulturePassInput(input);
    if (!contact) return;

    setCpCameraActive(false);
    setIsLookingUp(true);
    if (contact.cpid && contact.cpid !== 'Unknown') {
      const full = await lookupCpid(contact.cpid);
      setCpContact(full ?? contact);
    } else {
      setCpContact(contact);
    }
    setIsLookingUp(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [lookupCpid]);

  const handleCpBarcodeScanned = useCallback(({ data }: { data: string }) => {
    processScannedCpData(data);
  }, [processScannedCpData]);

  const handleCpManualScan = useCallback(async () => {
    const input = cpInput.trim();
    if (!input) { Alert.alert('Enter Data', 'Enter a CulturePass ID or paste QR data.'); return; }
    Keyboard.dismiss();
    setIsLookingUp(true);
    const contact = parseCulturePassInput(input);
    if (contact) {
      if (contact.cpid && contact.cpid !== 'Unknown') {
        const full = await lookupCpid(contact.cpid);
        setCpContact(full ?? contact);
      } else {
        setCpContact(contact);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCpInput('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Data', 'Enter a CulturePass ID (CP-XXXXXX), JSON, or vCard data.');
    }
    setIsLookingUp(false);
  }, [cpInput, lookupCpid]);

  const startCpCamera = useCallback(async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    cpLastScanned.current = '';
    setCpCameraActive(true);
  }, [ensureCameraPermission]);

  const handleSaveContact = useCallback(() => {
    if (!cpContact) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addContact({ cpid: cpContact.cpid, name: cpContact.name, username: cpContact.username, tier: cpContact.tier, org: cpContact.org, avatarUrl: cpContact.avatarUrl, city: cpContact.city, country: cpContact.country, bio: cpContact.bio, userId: cpContact.userId });
    Alert.alert('Contact Saved', `${cpContact.name || cpContact.cpid} added to your CulturePass contacts.`);
  }, [cpContact, addContact]);

  const contactAlreadySaved = cpContact ? isContactSaved(cpContact.cpid) : false;

  const handleViewProfile = useCallback(() => {
    if (!cpContact) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!contactAlreadySaved) handleSaveContact();
    router.push({ pathname: '/contacts/[cpid]' as any, params: { cpid: cpContact.cpid } });
  }, [cpContact, contactAlreadySaved, handleSaveContact]);

  // ── session duration ──────────────────────────────────────────────────────
  const sessionDuration = () => {
    const mins = Math.floor((Date.now() - session.startedAt.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => goBackOrReplace('/(tabs)')} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'tickets' ? 'Staff Scanner' : 'Scanner'}
        </Text>
        <View style={styles.headerRight}>
          {mode === 'tickets' ? (
            <Pressable style={styles.headerBtn} onPress={resetSession}>
              <Ionicons name="refresh-outline" size={20} color={Colors.error} />
            </Pressable>
          ) : (
            <Pressable style={[styles.headerBtn, { backgroundColor: Colors.primaryGlow }]} onPress={() => router.push('/contacts' as any)}>
              <Ionicons name="people-outline" size={20} color={Colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Mode toggle ────────────────────────────────────────────────────── */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleTab, mode === 'culturepass' && styles.toggleTabActive]}
          onPress={() => { setMode('culturepass'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Ionicons name="card-outline" size={16} color={mode === 'culturepass' ? '#FFF' : Colors.textSecondary} />
          <Text style={[styles.toggleText, mode === 'culturepass' && styles.toggleTextActive]}>CulturePass</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleTab, mode === 'tickets' && styles.toggleTabActive]}
          onPress={() => { setMode('tickets'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Ionicons name="ticket-outline" size={16} color={mode === 'tickets' ? '#FFF' : Colors.textSecondary} />
          <Text style={[styles.toggleText, mode === 'tickets' && styles.toggleTextActive]}>Staff Check-In</Text>
        </Pressable>
      </View>

      {/* ── Loading overlay ─────────────────────────────────────────────────── */}
      {isLookingUp && (
        <View style={styles.lookupOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.lookupText}>Looking up profile…</Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STAFF TICKET MODE                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {mode === 'tickets' && (
        <>
          {/* Session stats bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.success }]}>{session.accepted}</Text>
              <Text style={styles.statLabel}>Accepted</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.warning }]}>{session.duplicates}</Text>
              <Text style={styles.statLabel}>Duplicate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.error }]}>{session.rejected}</Text>
              <Text style={styles.statLabel}>Invalid</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.textSecondary }]}>{sessionDuration()}</Text>
              <Text style={styles.statLabel}>Session</Text>
            </View>
          </View>

          {/* Camera view for ticket QR scan */}
          {ticketCameraActive && (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
                onBarcodeScanned={handleTicketBarcodeScanned}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraFrame}>
                  <View style={[styles.cCorner, styles.cTL]} />
                  <View style={[styles.cCorner, styles.cTR]} />
                  <View style={[styles.cCorner, styles.cBL]} />
                  <View style={[styles.cCorner, styles.cBR]} />
                  {/* Scan line animation could be added here */}
                </View>
                <Text style={styles.cameraHint}>Point at a ticket QR code</Text>
              </View>
              <Pressable style={styles.closeCameraBtn} onPress={() => setTicketCameraActive(false)}>
                <Ionicons name="close-circle" size={38} color="#FFF" />
              </Pressable>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 + bottomInset }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!ticketCameraActive && (
              <View style={styles.scanInputSection}>
                {/* Camera scan button */}
                <Pressable style={styles.camScanBtn} onPress={startTicketCamera}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.camScanGradient}
                  >
                    <Ionicons name="camera" size={28} color="#FFF" />
                    <View>
                      <Text style={styles.camScanTitle}>Scan QR Code</Text>
                      <Text style={styles.camScanSub}>Camera • QR • Barcode</Text>
                    </View>
                  </LinearGradient>
                </Pressable>

                {/* Manual entry */}
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or enter manually</Text>
                  <View style={styles.orLine} />
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="Enter ticket code…"
                    placeholderTextColor={Colors.textTertiary}
                    value={ticketCode}
                    onChangeText={v => setTicketCode(v.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={handleManualTicketScan}
                  />
                  <Pressable
                    style={[styles.scanBtn, isScanning && styles.scanBtnDisabled]}
                    onPress={handleManualTicketScan}
                    disabled={isScanning}
                  >
                    {isScanning
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                    }
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Scan result card ─────────────────────────────────────────── */}
            {ticketResult && !ticketCameraActive && (
              <View style={styles.resultWrapper}>
                <TicketResultCard
                  result={ticketResult}
                  onClose={() => setTicketResult(null)}
                  onScanNext={() => { setTicketResult(null); startTicketCamera(); }}
                  onPrintBadge={() => {
                    if (!ticketResult.ticket?.id) return;
                    router.push({
                      pathname: '/tickets/print/[id]',
                      params: {
                        id: ticketResult.ticket.id,
                        layout: 'badge',
                        autoPrint: '1',
                      },
                    });
                  }}
                />
              </View>
            )}

            {/* ── Scan history ─────────────────────────────────────────────── */}
            {scanHistory.length > 0 && !ticketCameraActive && (
              <View style={styles.historySection}>
                <View style={styles.historySectionHeader}>
                  <Text style={styles.historyTitle}>Scan Log ({scanHistory.length})</Text>
                </View>
                {scanHistory.map((item, idx) => {
                  const cfg = getOutcomeConfig(item);
                  return (
                    <View key={idx} style={[styles.historyItem, { borderLeftColor: cfg.color }]}>
                      <View style={[styles.historyIconWrap, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyEventTitle} numberOfLines={1}>
                          {item.ticket?.eventTitle || 'Unknown Event'}
                        </Text>
                        <Text style={[styles.historyStatus, { color: cfg.color }]} numberOfLines={1}>
                          {cfg.title} · {item.message}
                        </Text>
                      </View>
                      {item.ticket?.tierName && (
                        <View style={[styles.historyTierChip, { backgroundColor: Colors.primary + '12' }]}>
                          <Text style={styles.historyTierText}>{item.ticket.tierName}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {scanHistory.length === 0 && !ticketResult && !ticketCameraActive && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="scan" size={40} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Ready to Check In</Text>
                <Text style={styles.emptyDesc}>Scan a QR code or enter a ticket code above to verify and mark attendance.</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CULTUREPASS CONTACT MODE                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {mode === 'culturepass' && (
        <>
          {cpCameraActive && (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleCpBarcodeScanned}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraFrame}>
                  <View style={[styles.cCorner, styles.cTL]} />
                  <View style={[styles.cCorner, styles.cTR]} />
                  <View style={[styles.cCorner, styles.cBL]} />
                  <View style={[styles.cCorner, styles.cBR]} />
                </View>
                <Text style={styles.cameraHint}>Point at a CulturePass QR code</Text>
              </View>
              <Pressable style={styles.closeCameraBtn} onPress={() => setCpCameraActive(false)}>
                <Ionicons name="close-circle" size={38} color="#FFF" />
              </Pressable>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 + bottomInset }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!cpCameraActive && !cpContact && (
              <View style={styles.scanInputSection}>
                <Pressable style={styles.cameraStartBtn} onPress={startCpCamera}>
                  <View style={styles.cameraIconCircle}>
                    <Ionicons name="camera" size={32} color="#FFF" />
                  </View>
                  <Text style={styles.cameraStartTitle}>Scan QR Code</Text>
                  <Text style={styles.cameraStartSub}>
                    {Platform.OS === 'web' ? 'Use manual input on web' : 'Tap to open camera'}
                  </Text>
                </Pressable>

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or enter manually</Text>
                  <View style={styles.orLine} />
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="CP-123456 or paste QR data…"
                    placeholderTextColor={Colors.textTertiary}
                    value={cpInput}
                    onChangeText={setCpInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={handleCpManualScan}
                  />
                  <Pressable
                    style={[styles.scanBtn, { backgroundColor: Colors.primary }]}
                    onPress={handleCpManualScan}
                    disabled={isLookingUp}
                  >
                    <Ionicons name="search" size={22} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            )}

            {cpContact && (
              <View style={styles.cpCard}>
                <View style={styles.cpCardHeader}>
                  <View style={styles.cpAvatar}>
                    <Text style={styles.cpAvatarText}>
                      {(cpContact.name || cpContact.cpid).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Pressable onPress={() => { setCpContact(null); setCpInput(''); cpLastScanned.current = ''; }} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>

                <Text style={styles.cpName}>{cpContact.name || 'CulturePass User'}</Text>
                {cpContact.username && <Text style={styles.cpUsername}>@{cpContact.username}</Text>}

                <View style={styles.cpChipRow}>
                  <View style={styles.cpIdChip}>
                    <Ionicons name="finger-print" size={13} color={Colors.primary} />
                    <Text style={styles.cpIdText}>{cpContact.cpid}</Text>
                  </View>
                  {cpContact.tier && (
                    <View style={[styles.cpTierChip, { backgroundColor: (TIER_DISPLAY[cpContact.tier]?.color ?? Colors.textSecondary) + '15' }]}>
                      <Ionicons name={(TIER_DISPLAY[cpContact.tier]?.icon ?? 'shield-outline') as any} size={12} color={TIER_DISPLAY[cpContact.tier]?.color ?? Colors.textSecondary} />
                      <Text style={[styles.cpTierText, { color: TIER_DISPLAY[cpContact.tier]?.color ?? Colors.textSecondary }]}>
                        {TIER_DISPLAY[cpContact.tier]?.label ?? 'Free'}
                      </Text>
                    </View>
                  )}
                </View>

                {cpContact.city && (
                  <View style={styles.cpLocationRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.cpLocationText}>{cpContact.city}{cpContact.country ? `, ${cpContact.country}` : ''}</Text>
                  </View>
                )}
                {cpContact.bio && <Text style={styles.cpBio} numberOfLines={2}>{cpContact.bio}</Text>}
                {cpContact.org && (
                  <View style={styles.cpLocationRow}>
                    <Ionicons name="business-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.cpLocationText}>{cpContact.org}</Text>
                  </View>
                )}

                <View style={styles.cpActions}>
                  <Pressable style={styles.cpActionBtn} onPress={handleViewProfile}>
                    <Ionicons name="person-outline" size={18} color={Colors.primary} />
                    <Text style={[styles.cpActionText, { color: Colors.primary }]}>View Profile</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cpActionBtn, contactAlreadySaved && styles.cpActionSaved]}
                    onPress={handleSaveContact}
                    disabled={contactAlreadySaved}
                  >
                    <Ionicons
                      name={contactAlreadySaved ? 'checkmark-circle' : 'bookmark-outline'}
                      size={18}
                      color={contactAlreadySaved ? Colors.success : Colors.accent}
                    />
                    <Text style={[styles.cpActionText, { color: contactAlreadySaved ? Colors.success : Colors.accent }]}>
                      {contactAlreadySaved ? 'Saved' : 'Save Contact'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {!cpContact && !cpCameraActive && (
              <View style={styles.hintSection}>
                <Text style={styles.hintTitle}>Supported Formats</Text>
                {[
                  { icon: 'finger-print', color: Colors.primary, label: 'CulturePass ID', example: 'CP-123456' },
                  { icon: 'code-slash', color: Colors.secondary, label: 'JSON QR Data', example: '{"type":"culturepass_id","cpid":"CP-..."}' },
                  { icon: 'document-text-outline', color: Colors.accent, label: 'vCard Data', example: 'BEGIN:VCARD...' },
                ].map(item => (
                  <View key={item.label} style={styles.hintItem}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hintLabel}>{item.label}</Text>
                      <Text style={styles.hintExample} numberOfLines={1}>{item.example}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ─── Ticket Result Card component ────────────────────────────────────────────
function TicketResultCard({ result, onClose, onScanNext, onPrintBadge }: {
  result: TicketScanResult;
  onClose: () => void;
  onScanNext: () => void;
  onPrintBadge: () => void;
}) {
  const cfg = getOutcomeConfig(result);
  const t = result.ticket;

  return (
    <View style={[resultStyles.card, { borderColor: cfg.color + '40' }]}>
      {/* Status header */}
      <LinearGradient
        colors={[cfg.color + '18', cfg.color + '05']}
        style={resultStyles.statusHeader}
      >
        <Ionicons name={cfg.icon} size={36} color={cfg.color} />
        <View style={{ flex: 1 }}>
          <Text style={[resultStyles.statusTitle, { color: cfg.color }]}>{cfg.title}</Text>
          <Text style={resultStyles.statusMsg}>{result.message}</Text>
        </View>
        <Pressable onPress={onClose} style={resultStyles.closeBtn}>
          <Ionicons name="close" size={20} color="#8E8E93" />
        </Pressable>
      </LinearGradient>

      {/* Ticket details */}
      {t && (
        <View style={resultStyles.details}>
          <Text style={resultStyles.eventTitle} numberOfLines={2}>{t.eventTitle}</Text>

          <View style={resultStyles.metaGrid}>
            {t.eventDate && (
              <View style={resultStyles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                <Text style={resultStyles.metaValue}>{t.eventDate}</Text>
              </View>
            )}
            {t.eventTime && (
              <View style={resultStyles.metaItem}>
                <Ionicons name="time-outline" size={14} color={Colors.secondary} />
                <Text style={resultStyles.metaValue}>{t.eventTime}</Text>
              </View>
            )}
            {t.eventVenue && (
              <View style={[resultStyles.metaItem, { flex: 1, width: '100%' }]}>
                <Ionicons name="location-outline" size={14} color={Colors.accent} />
                <Text style={resultStyles.metaValue} numberOfLines={1}>{t.eventVenue}</Text>
              </View>
            )}
          </View>

          <View style={resultStyles.badgeRow}>
            {t.tierName && (
              <View style={[resultStyles.badge, { backgroundColor: Colors.primary + '12' }]}>
                <Text style={[resultStyles.badgeText, { color: Colors.primary }]}>{t.tierName}</Text>
              </View>
            )}
            <View style={[resultStyles.badge, { backgroundColor: Colors.textSecondary + '12' }]}>
              <Ionicons name="ticket-outline" size={12} color={Colors.textSecondary} />
              <Text style={resultStyles.badgeText}>{t.quantity || 1}x</Text>
            </View>
            {t.ticketCode && (
              <View style={[resultStyles.badge, { backgroundColor: cfg.color + '12', marginLeft: 'auto' }]}>
                <Text style={[resultStyles.badgeText, { color: cfg.color, letterSpacing: 1 }]}>{t.ticketCode}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={resultStyles.actions}>
        <Pressable style={resultStyles.actionSecondary} onPress={onClose}>
          <Text style={resultStyles.actionSecondaryText}>Done</Text>
        </Pressable>
        {t?.id ? (
          <Pressable style={resultStyles.actionSecondary} onPress={onPrintBadge}>
            <Ionicons name="print-outline" size={16} color={Colors.warning} />
            <Text style={[resultStyles.actionSecondaryText, { color: Colors.warning }]}>Print Badge</Text>
          </Pressable>
        ) : null}
        <Pressable style={resultStyles.actionPrimary} onPress={onScanNext}>
          <Ionicons name="camera" size={16} color="#FFF" />
          <Text style={resultStyles.actionPrimaryText}>Scan Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CORNER = 28;
const CORNER_W = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  headerRight: { width: 38, alignItems: 'flex-end' },

  toggleContainer: {
    flexDirection: 'row', marginHorizontal: 20,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 4, gap: 4,
  },
  toggleTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  toggleTabActive: { backgroundColor: Colors.primary },
  toggleText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  toggleTextActive: { color: '#FFF' },

  // Staff stats bar
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14,
    ...Colors.shadow.small,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontFamily: 'Poppins_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  statDivider: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },

  // Camera
  cameraContainer: {
    height: 300, marginHorizontal: 20, marginTop: 14,
    borderRadius: 20, overflow: 'hidden', position: 'relative',
  },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { width: 210, height: 210, position: 'relative' },
  cCorner: { position: 'absolute', width: CORNER, height: CORNER },
  cTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderColor: '#FFF', borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderColor: '#FFF', borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderColor: '#FFF', borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderColor: '#FFF', borderBottomRightRadius: 8 },
  cameraHint: {
    marginTop: 230, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium',
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  closeCameraBtn: { position: 'absolute', top: 12, right: 12 },

  // Input section
  scanInputSection: { marginHorizontal: 20, marginTop: 14, gap: 10 },
  camScanBtn: { borderRadius: 16, overflow: 'hidden', ...Colors.shadow.small },
  camScanGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 22, paddingVertical: 18,
  },
  camScanTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: '#FFF' },
  camScanSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  orText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },

  inputRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: 'Poppins_500Medium', color: Colors.text,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  scanBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  scanBtnDisabled: { opacity: 0.6 },

  resultWrapper: { marginHorizontal: 20, marginTop: 14 },

  // History
  historySection: { marginHorizontal: 20, marginTop: 20 },
  historySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.text },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderLeftWidth: 3, ...Colors.shadow.small,
  },
  historyIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyEventTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  historyStatus: { fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  historyTierChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyTierText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 40, gap: 12 },
  emptyIconBg: {
    width: 88, height: 88, borderRadius: 26, marginBottom: 4,
    backgroundColor: Colors.primary + '10', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text },
  emptyDesc: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Lookup overlay
  lookupOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 200,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  lookupText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  // CulturePass card
  cameraStartBtn: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, ...Colors.shadow.small,
  },
  cameraIconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  cameraStartTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  cameraStartSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center' },

  cpCard: {
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24, ...Colors.shadow.medium,
  },
  cpCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cpAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  cpAvatarText: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  cpName: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 2 },
  cpUsername: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 12 },
  cpChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cpIdChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  cpIdText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  cpTierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  cpTierText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  cpLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cpLocationText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  cpBio: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  cpActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cpActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.background, paddingVertical: 12, borderRadius: 14,
  },
  cpActionSaved: { backgroundColor: Colors.success + '10' },
  cpActionText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  hintSection: {
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 18, gap: 14,
  },
  hintTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.text },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hintLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  hintExample: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
});

const resultStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, ...Colors.shadow.medium,
  },
  statusHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  statusTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  statusMsg: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background + 'CC', alignItems: 'center', justifyContent: 'center' },
  details: { paddingHorizontal: 16, paddingBottom: 14 },
  eventTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 10 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaValue: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  actions: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 12, backgroundColor: Colors.background,
  },
  actionSecondaryText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  actionPrimary: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary,
  },
  actionPrimaryText: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#FFF' },
});
