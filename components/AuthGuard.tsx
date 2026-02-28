import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  /** Icon shown in the prompt (Ionicons name) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Main heading of the sign-in prompt */
  title?: string;
  /** Subtext explaining why sign-in is needed */
  message?: string;
  /** Show a back arrow so users can dismiss the prompt */
  showBack?: boolean;
}

/**
 * Wraps a screen that requires authentication.
 * Authenticated users see `children` as normal.
 * Guests see a branded sign-in prompt with Sign In / Create Account CTAs.
 */
export function AuthGuard({
  children,
  icon = 'lock-closed-outline',
  title = 'Sign in to continue',
  message = 'Create a free account to unlock this feature and discover cultural events across Australia.',
  showBack = true,
}: AuthGuardProps) {
  const { userId, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return null;
  }

  if (userId) {
    return <>{children}</>;
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <LinearGradient
        colors={['#001028', '#00305A', '#0081C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative orbs */}
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      {showBack && (
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={44} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.featureList}>
          {[
            'Browse & buy tickets for cultural events',
            'Save events and join communities',
            'Access your tickets & QR codes',
            'Manage your CulturePass profile',
          ].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#FCB131" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/(onboarding)/signup')}
        >
          <Text style={styles.primaryBtnText}>Create Free Account</Text>
          <Ionicons name="arrow-forward" size={18} color="#001028" />
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/(onboarding)/login')}
        >
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </Pressable>

        <Pressable
          style={styles.browseBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.browseBtnText}>Back to Discovery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001028',
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
  },
  orbTop: {
    width: 280,
    height: 280,
    top: -60,
    right: -80,
    backgroundColor: 'rgba(0,129,200,0.22)',
  },
  orbBottom: {
    width: 220,
    height: 220,
    bottom: '15%',
    left: -70,
    backgroundColor: 'rgba(238,51,78,0.15)',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 0,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(0,129,200,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(64,168,232,0.5)',
    marginBottom: 24,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  featureList: {
    gap: 10,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#001028',
  },
  secondaryBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
  },
  browseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  browseBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.4)',
  },
});
