import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useContacts } from '@/contexts/ContactsContext';
import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Tier config ─────────────────────────────────────────────────────────────

const TIER_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  free: { label: 'Standard', color: Colors.textSecondary, icon: 'shield-outline' },
  plus: { label: 'Plus', color: '#3498DB', icon: 'star' },
  premium: { label: 'Premium', color: '#F39C12', icon: 'diamond' },
  elite: { label: 'Elite', color: '#8E44AD', icon: 'trophy' },
  vip: { label: 'VIP', color: '#E74C3C', icon: 'ribbon' },
  pro: { label: 'Pro', color: '#27AE60', icon: 'briefcase' },
};

// ─── vCard builder ────────────────────────────────────────────────────────────

function buildVCard(contact: ReturnType<ReturnType<typeof useContacts>['getContact']>): string {
  if (!contact) return '';

  const nameParts = (contact.name || 'CulturePass User').split(' ');
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name || 'CulturePass User'}`,
    `N:${lastName};${firstName};;;`,
  ];

  if (contact.org) {
    lines.push(`ORG:${contact.org}`);
  }
  if (contact.phone) {
    lines.push(`TEL;TYPE=CELL:${contact.phone}`);
  }
  if (contact.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`);
  }
  if (contact.username) {
    lines.push(`URL;TYPE=WORK:https://culturepass.app/u/${contact.username}`);
    lines.push(`X-SOCIALPROFILE;type=culturepass:${contact.username}`);
  }
  if (contact.city || contact.country) {
    lines.push(`ADR;TYPE=HOME:;;${contact.city || ''};${contact.country || ''};;;`);
  }
  if (contact.avatarUrl) {
    lines.push(`PHOTO;VALUE=URI:${contact.avatarUrl}`);
  }

  const noteLines = [`CulturePass ID: ${contact.cpid}`];
  if (contact.bio) noteLines.push(contact.bio);
  lines.push(`NOTE:${noteLines.join(' | ')}`);

  lines.push('END:VCARD');
  return lines.join('\n');
}

// ─── Save vCard to phone ──────────────────────────────────────────────────────

async function saveVCardToPhone(contact: NonNullable<ReturnType<ReturnType<typeof useContacts>['getContact']>>) {
  const vCardString = buildVCard(contact);
  const displayName = contact.name || contact.cpid;

  if (Platform.OS === 'web') {
    // Web: trigger .vcf download
    const blob = new Blob([vCardString], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayName.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write .vcf to cache, then share — iOS opens "Add to Contacts"
  try {
    const safeName = displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileUri = (FileSystem.cacheDirectory ?? '') + `${safeName}.vcf`;

    await FileSystem.writeAsStringAsync(fileUri, vCardString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Share.share({
      title: `Save ${displayName} to Contacts`,
      message: vCardString,
      url: fileUri,
    });
  } catch {
    // Fallback: share vCard as plain text
    await Share.share({
      title: `Save ${displayName} to Contacts`,
      message: vCardString,
    });
  }
}

// ─── Info row component ───────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  color = Colors.text,
  onPress,
  badge,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
  onPress?: () => void;
  badge?: string;
}) {
  const content = (
    <View style={rowStyles.container}>
      <View style={[rowStyles.iconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={rowStyles.textWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={[rowStyles.value, onPress && { color }]} numberOfLines={1}>{value}</Text>
      </View>
      {badge && (
        <View style={rowStyles.badge}>
          <Text style={rowStyles.badgeText}>{badge}</Text>
        </View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress}>{content}</Pressable>
  ) : (
    content
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    color: Colors.text,
    marginTop: 1,
  },
  badge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ContactDetailScreen() {
  const { cpid } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { getContact, removeContact } = useContacts();

  const contact = getContact(cpid as string);

  const handleShare = useCallback(async () => {
    if (!contact) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const profileUrl = contact.username
      ? `https://culturepass.app/u/${contact.username}`
      : '';
    try {
      await Share.share({
        title: `${contact.name} on CulturePass`,
        message: `Check out ${contact.name || contact.cpid} on CulturePass!\nCPID: ${contact.cpid}${profileUrl ? `\n${profileUrl}` : ''}`,
        url: profileUrl || undefined,
      });
    } catch {}
  }, [contact]);

  const handleSaveToPhone = useCallback(async () => {
    if (!contact) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveVCardToPhone(contact);
    } catch {
      Alert.alert('Error', 'Could not save contact. Please try again.');
    }
  }, [contact]);

  const handleRemove = useCallback(() => {
    if (!contact) return;
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name || contact.cpid} from your saved contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removeContact(contact.cpid);
            goBackOrReplace('/(tabs)');
          },
        },
      ]
    );
  }, [contact, removeContact]);

  const handleViewProfile = useCallback(() => {
    if (!contact?.userId) {
      Alert.alert('Profile', 'Full profile is not available for this contact.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/user/[id]', params: { id: contact.userId } });
  }, [contact]);

  const handleCall = useCallback(() => {
    if (!contact?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${contact.phone}`);
  }, [contact]);

  const handleEmail = useCallback(() => {
    if (!contact?.email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${contact.email}`);
  }, [contact]);

  const handleOpenLocation = useCallback(() => {
    if (!contact?.city) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = `${contact.city}${contact.country ? `, ${contact.country}` : ''}`;
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(q)}`);
  }, [contact]);

  if (!contact) {
    return (
      <View style={[styles.container, { paddingTop: topInset, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="person-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Contact not found</Text>
        <Pressable style={styles.backLink} onPress={() => goBackOrReplace('/(tabs)')}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const tier = TIER_DISPLAY[contact.tier || 'free'] || TIER_DISPLAY.free;
  const initials = (contact.name || contact.cpid)
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const savedDate = new Date(contact.savedAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => goBackOrReplace('/(tabs)')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Contact</Text>
        <Pressable style={styles.headerShareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + bottomInset }}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { borderColor: tier.color + '50' }]}>
            <Text style={[styles.avatarText, { color: tier.color }]}>{initials}</Text>
          </View>

          <Text style={styles.name}>{contact.name || 'CulturePass User'}</Text>
          {contact.username && (
            <Text style={styles.username}>@{contact.username}</Text>
          )}
          {contact.org && (
            <Text style={styles.orgName}>{contact.org}</Text>
          )}

          {/* CPID + tier chips */}
          <View style={styles.chipRow}>
            <View style={styles.cpidChip}>
              <Ionicons name="finger-print" size={14} color={Colors.primary} />
              <Text style={styles.cpidText}>{contact.cpid}</Text>
            </View>
            <View style={[styles.tierChip, { backgroundColor: tier.color + '15' }]}>
              <Ionicons name={tier.icon as any} size={12} color={tier.color} />
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>

          {/* Quick-action icons */}
          <View style={styles.quickActions}>
            {contact.phone && (
              <Pressable style={styles.quickActionBtn} onPress={handleCall}>
                <Ionicons name="call" size={20} color={Colors.success} />
                <Text style={[styles.quickActionLabel, { color: Colors.success }]}>Call</Text>
              </Pressable>
            )}
            {contact.email && (
              <Pressable style={styles.quickActionBtn} onPress={handleEmail}>
                <Ionicons name="mail" size={20} color={Colors.primary} />
                <Text style={[styles.quickActionLabel, { color: Colors.primary }]}>Email</Text>
              </Pressable>
            )}
            <Pressable style={styles.quickActionBtn} onPress={handleSaveToPhone}>
              <Ionicons name="person-add" size={20} color={Colors.accent} />
              <Text style={[styles.quickActionLabel, { color: Colors.accent }]}>Save</Text>
            </Pressable>
            <Pressable style={styles.quickActionBtn} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color={Colors.secondary} />
              <Text style={[styles.quickActionLabel, { color: Colors.secondary }]}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* Bio */}
        {contact.bio && (
          <View style={styles.bioCard}>
            <Text style={styles.bioText}>{contact.bio}</Text>
          </View>
        )}

        {/* Contact info */}
        <View style={styles.infoCard}>
          {contact.phone && (
            <InfoRow
              icon="call"
              label="Phone"
              value={contact.phone}
              color={Colors.success}
              onPress={handleCall}
            />
          )}
          {contact.phone && (contact.email || contact.city || contact.org) && (
            <View style={styles.divider} />
          )}
          {contact.email && (
            <InfoRow
              icon="mail"
              label="Email"
              value={contact.email}
              color={Colors.primary}
              onPress={handleEmail}
            />
          )}
          {contact.email && (contact.city || contact.org) && (
            <View style={styles.divider} />
          )}
          {contact.org && (
            <InfoRow
              icon="business"
              label="Organisation"
              value={contact.org}
              color={Colors.textSecondary}
            />
          )}
          {contact.org && contact.city && <View style={styles.divider} />}
          {contact.city && (
            <InfoRow
              icon="location"
              label="Location"
              value={`${contact.city}${contact.country ? `, ${contact.country}` : ''}`}
              color={Colors.primary}
              onPress={handleOpenLocation}
            />
          )}
          {(contact.phone || contact.email || contact.org || contact.city) && (
            <View style={styles.divider} />
          )}
          <InfoRow
            icon="calendar-outline"
            label="Saved on"
            value={savedDate}
            color={Colors.textSecondary}
          />
        </View>

        {/* CulturePass section */}
        <View style={styles.infoCard}>
          {contact.username && (
            <>
              <InfoRow
                icon="globe-outline"
                label="CulturePass Profile"
                value={`culturepass.app/u/${contact.username}`}
                color={Colors.primary}
                onPress={() =>
                  Linking.openURL(`https://culturepass.app/u/${contact.username}`)
                }
              />
              <View style={styles.divider} />
            </>
          )}
          <InfoRow
            icon="finger-print"
            label="CulturePass ID"
            value={contact.cpid}
            color={Colors.primary}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {contact.userId && (
            <Pressable style={styles.actionBtn} onPress={handleViewProfile}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>View Full Profile</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>
          )}

          <Pressable style={styles.actionBtn} onPress={handleSaveToPhone}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Ionicons name="person-add-outline" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Save to Phone Contacts</Text>
              <Text style={styles.actionBtnSub}>Exports as vCard (.vcf)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleShare}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '15' }]}>
              <Ionicons name="share-outline" size={18} color={Colors.secondary} />
            </View>
            <Text style={[styles.actionBtnText, { color: Colors.secondary }]}>Share Contact</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </Pressable>

          <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleRemove}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.error + '15' }]}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </View>
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Remove Contact</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </Pressable>
        </View>
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
  headerShareBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Colors.shadow.medium,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 16,
  },
  avatarText: { fontSize: 30, fontFamily: 'Poppins_700Bold' },
  name: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text, textAlign: 'center' },
  username: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  orgName: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textTertiary,
    marginTop: 2,
  },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cpidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  cpidText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tierText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  quickActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    width: '100%',
    justifyContent: 'center',
  },
  quickActionBtn: { alignItems: 'center', gap: 6, minWidth: 56 },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },

  bioCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...Colors.shadow.small,
  },
  bioText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  infoCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Colors.shadow.small,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 66 },

  actionsSection: {
    marginHorizontal: 20,
    marginTop: 24,
    gap: 8,
    paddingBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    ...Colors.shadow.small,
  },
  actionBtnDanger: {
    borderWidth: 1,
    borderColor: Colors.error + '20',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  actionBtnSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textTertiary,
    marginTop: 1,
  },

  notFoundText: {
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  backLink: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  backLinkText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#FFF' },
});
