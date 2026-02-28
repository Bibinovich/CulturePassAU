import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/auth';
import { useRole } from '@/hooks/useRole';
import { Colors } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  /** Exact match or prefix match for highlighting */
  matchPrefix?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Discover',   icon: 'compass-outline',       iconActive: 'compass',        route: '/(tabs)' },
  { label: 'Calendar',   icon: 'calendar-outline',      iconActive: 'calendar',       route: '/(tabs)/calendar' },
  { label: 'Community',  icon: 'people-outline',        iconActive: 'people',         route: '/(tabs)/communities' },
];

const ORGANIZER_NAV: NavItem[] = [
  { label: 'Dashboard',  icon: 'grid-outline',          iconActive: 'grid',           route: '/dashboard/organizer', matchPrefix: true },
  { label: 'Submit',     icon: 'add-circle-outline',    iconActive: 'add-circle',     route: '/submit' },
  { label: 'Scanner',    icon: 'qr-code-outline',       iconActive: 'qr-code',        route: '/scanner' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Admin Panel', icon: 'people-circle-outline', iconActive: 'people-circle', route: '/admin/users', matchPrefix: true },
];

const BOTTOM_NAV: NavItem[] = [
  { label: 'Profile',    icon: 'person-circle-outline', iconActive: 'person-circle',  route: '/(tabs)/profile' },
  { label: 'Settings',   icon: 'settings-outline',      iconActive: 'settings',       route: '/settings' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function WebSidebar() {
  const pathname = usePathname();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { user, logout } = useAuth();
  const { isOrganizer, isAdmin, role } = useRole();

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) return pathname.startsWith(item.route.replace('/(tabs)', ''));
    // Special case: Discover is the index tab
    if (item.route === '/(tabs)') return pathname === '/' || pathname === '/index' || pathname === '';
    const bare = item.route.replace('/(tabs)/', '/').replace('/(tabs)', '/');
    return pathname === bare || pathname.startsWith(bare + '/');
  };

  const navigate = (route: string) => {
    router.navigate(route as Parameters<typeof router.navigate>[0]);
  };

  const displayName = user?.username ?? user?.id?.slice(0, 8) ?? 'You';
  const roleLabel = role === 'platformAdmin' ? 'Platform Admin' : role === 'admin' ? 'Admin' : role === 'organizer' ? 'Organizer' : null;

  return (
    <View style={[
      styles.sidebar,
      {
        backgroundColor: isDark ? '#060B14' : '#fff',
        borderRightColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
      },
    ]}>
      {/* Logo */}
      <Pressable style={styles.logo} onPress={() => navigate('/(tabs)')}>
        <View style={styles.logoIcon}>
          <LinearGradient colors={['#0081C8', '#EE334E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="globe-outline" size={18} color="#fff" />
        </View>
        <View>
          <Text style={[styles.logoText, { color: isDark ? '#E8F4FF' : '#001628' }]}>CulturePass</Text>
          <Text style={[styles.logoUrl, { color: isDark ? 'rgba(232,244,255,0.35)' : 'rgba(0,22,40,0.35)' }]}>CulturePass.App</Text>
        </View>
      </Pressable>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

      {/* Main nav */}
      <View style={styles.navGroup}>
        {MAIN_NAV.map((item) => (
          <SidebarItem key={item.route} item={item} active={isActive(item)} isDark={isDark} onPress={() => navigate(item.route)} />
        ))}
      </View>

      {/* Organizer nav */}
      {isOrganizer && (
        <>
          <View style={styles.sectionLabel}>
            <Text style={[styles.sectionLabelText, { color: isDark ? 'rgba(232,244,255,0.35)' : 'rgba(0,22,40,0.35)' }]}>Organizer</Text>
          </View>
          <View style={styles.navGroup}>
            {ORGANIZER_NAV.map((item) => (
              <SidebarItem key={item.route} item={item} active={isActive(item)} isDark={isDark} onPress={() => navigate(item.route)} />
            ))}
            {ADMIN_NAV.map((item) =>
              isAdmin ? (
                <SidebarItem key={item.route} item={item} active={isActive(item)} isDark={isDark} onPress={() => navigate(item.route)} />
              ) : null
            )}
          </View>
        </>
      )}

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

      {/* Bottom nav */}
      <View style={styles.navGroup}>
        {BOTTOM_NAV.map((item) => (
          <SidebarItem key={item.route} item={item} active={isActive(item)} isDark={isDark} onPress={() => navigate(item.route)} />
        ))}
      </View>

      {/* User section */}
      <View style={[styles.userSection, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
        <View style={styles.avatar}>
          <LinearGradient colors={['#0081C8', '#EE334E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: isDark ? '#E8F4FF' : '#001628' }]} numberOfLines={1}>{displayName}</Text>
          {roleLabel && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => logout()} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={isDark ? 'rgba(232,244,255,0.45)' : 'rgba(0,22,40,0.45)'} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Item
// ---------------------------------------------------------------------------
function SidebarItem({ item, active, isDark, onPress }: {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        itemStyles.item,
        active && [itemStyles.itemActive, { backgroundColor: isDark ? 'rgba(0,129,200,0.12)' : 'rgba(0,129,200,0.08)' }],
      ]}
      onPress={onPress}
    >
      {active && (
        <LinearGradient
          colors={['#0081C8', '#EE334E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={itemStyles.activeBar}
        />
      )}
      <Ionicons
        name={active ? item.iconActive : item.icon}
        size={20}
        color={active ? Colors.primary : (isDark ? 'rgba(232,244,255,0.5)' : 'rgba(0,22,40,0.5)')}
      />
      <Text
        style={[
          itemStyles.label,
          { color: active ? Colors.primary : (isDark ? 'rgba(232,244,255,0.7)' : 'rgba(0,22,40,0.7)') },
          active && itemStyles.labelActive,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    height: '100%' as unknown as number,
    borderRightWidth: 1,
    paddingTop: 20,
    paddingBottom: 0,
    flexShrink: 0,
  },
  logo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 18,
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoText: { fontSize: 16, fontFamily: 'Poppins_700Bold' },
  logoUrl: { fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  divider: { height: 1, marginHorizontal: 18, marginVertical: 6 },
  navGroup: { paddingHorizontal: 10, paddingVertical: 4, gap: 2 },
  sectionLabel: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  sectionLabelText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },
  userSection: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
  userName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  roleBadge: { backgroundColor: 'rgba(0,129,200,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  roleBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
});

const itemStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    position: 'relative',
  },
  itemActive: {
    borderRadius: 10,
  },
  activeBar: {
    position: 'absolute', left: 0, top: 6, bottom: 6,
    width: 3, borderRadius: 2,
  },
  label: { fontSize: 14, fontFamily: 'Poppins_500Medium' },
  labelActive: { fontFamily: 'Poppins_600SemiBold' },
});
