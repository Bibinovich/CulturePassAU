import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/query-client';
import { useColors } from '@/hooks/useColors';
import { useRole } from '@/hooks/useRole';
import { Colors } from '@/constants/theme';
import type { UserRole } from '@/shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  role?: UserRole;
  avatarUrl?: string;
  city?: string;
  country?: string;
  subscriptionTier?: string;
  createdAt?: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: { key: UserRole; label: string; description: string; color: string }[] = [
  { key: 'user',         label: 'User',          description: 'Standard member',         color: Colors.textSecondary },
  { key: 'organizer',    label: 'Organizer',      description: 'Can create & manage events', color: Colors.primary },
  { key: 'business',     label: 'Business',       description: 'Business listing owner',  color: Colors.accent },
  { key: 'sponsor',      label: 'Sponsor',        description: 'Community sponsor',        color: Colors.gold },
  { key: 'cityAdmin',    label: 'City Admin',     description: 'Manages a city region',   color: Colors.info },
  { key: 'moderator',    label: 'Moderator',      description: 'Reviews content & reports', color: Colors.warning },
  { key: 'admin',        label: 'Admin',          description: 'Full platform access',    color: Colors.secondary },
  { key: 'platformAdmin', label: 'Platform Admin', description: 'Super administrator',    color: Colors.error },
];

const ROLE_RANK: Record<UserRole, number> = {
  user: 0, organizer: 1, business: 1, sponsor: 1,
  cityAdmin: 2, moderator: 3, admin: 4, platformAdmin: 4,
};

// ---------------------------------------------------------------------------
// Role chip
// ---------------------------------------------------------------------------

function RoleChip({ role }: { role?: UserRole }) {
  const r = ROLES.find(x => x.key === (role ?? 'user')) ?? ROLES[0];
  return (
    <View style={[styles.chip, { borderColor: r.color }]}>
      <Text style={[styles.chipText, { color: r.color }]}>{r.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

function UserRow({ user, onAssignRole }: { user: AdminUser; onAssignRole: (u: AdminUser) => void }) {
  const colors = useColors();
  const displayName = user.displayName ?? user.username ?? 'Unknown';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onAssignRole(user)}
    >
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: colors.primaryGlow }]}>
          <Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
        <Text style={[styles.rowEmail, { color: colors.textSecondary }]} numberOfLines={1}>
          {user.email ?? `@${user.username}`}
        </Text>
        {user.city ? (
          <Text style={[styles.rowCity, { color: colors.textTertiary }]}>{user.city}{user.country ? `, ${user.country}` : ''}</Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <RoleChip role={user.role} />
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? 67 : 0;
  const colors = useColors();
  const { isAdmin, isLoading: roleLoading } = useRole();
  const [search, setSearch] = useState('');
  const [page] = useState(0);

  // Route guard
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [isAdmin, roleLoading]);

  const { data, isLoading, refetch } = useQuery<AdminUsersResponse>({
    queryKey: ['/api/admin/users', page],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/users?limit=50&page=${page}`);
      return res.json();
    },
    enabled: isAdmin,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await apiRequest('PUT', `/api/admin/users/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to assign role. Please try again.');
    },
  });

  const filteredUsers = useMemo(() => {
    const users = data?.users ?? [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.displayName ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }, [data?.users, search]);

  const handleAssignRole = (user: AdminUser) => {
    const currentRole = user.role ?? 'user';
    const options = ROLES.map(r => ({
      text: `${r.label} — ${r.description}${r.key === currentRole ? ' ✓' : ''}`,
      onPress: () => {
        if (r.key === currentRole) return;
        Alert.alert(
          'Assign Role',
          `Change ${user.displayName ?? user.username}'s role to "${r.label}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              onPress: () => assignRoleMutation.mutate({ userId: user.id, role: r.key }),
            },
          ]
        );
      },
    }));

    Alert.alert(
      `Assign Role — ${user.displayName ?? user.username}`,
      `Current role: ${currentRole}`,
      [
        ...options.sort((a, b) => {
          const ra = ROLES.find(r => a.text.startsWith(r.label))!;
          const rb = ROLES.find(r => b.text.startsWith(r.label))!;
          return ROLE_RANK[ra.key] - ROLE_RANK[rb.key];
        }),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (roleLoading || (!isAdmin && !roleLoading)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Panel</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {data?.total ?? 0} users
          </Text>
        </View>
        <Pressable onPress={() => refetch()} hitSlop={8} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name or email…"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Role legend */}
      <View style={styles.legend}>
        {ROLES.slice(0, 5).map(r => (
          <View key={r.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: r.color }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{r.label}</Text>
          </View>
        ))}
      </View>

      {/* User list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading users…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <View>
              <UserRow user={item} onAssignRole={handleAssignRole} />
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18 },
  headerSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: -2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    padding: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontFamily: 'Poppins_700Bold', fontSize: 16 },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  rowEmail: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  rowCity: { fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 15 },
  loadingText: { fontFamily: 'Poppins_400Regular', fontSize: 14 },
});
