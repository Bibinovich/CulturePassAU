import { View, Text, Pressable, StyleSheet, TextInput, Platform, KeyboardAvoidingView, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { auth as firebaseAuth } from '@/lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Button } from '@/components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboarding } from '@/contexts/OnboardingContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { state: onboardingState } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isValid = email.trim().length > 0 && password.length >= 6;

  const postAuthRoute = () => {
    if (onboardingState.isComplete) {
      router.replace('/(tabs)');
    } else {
      router.push('/(onboarding)/location');
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS !== 'web') {
      // Native Google Sign-In requires @react-native-google-signin/google-signin
      // which needs a native build. This is a planned feature.
      Alert.alert(
        'Use Email Sign-In',
        'Google sign-in on the mobile app is coming soon. Please sign in with your email and password.',
      );
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      postAuthRoute();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Google sign-in failed. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      postAuthRoute();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please try again.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
      <View style={styles.logoRow}>
        <View style={styles.logoCircle}><Ionicons name="globe-outline" size={34} color={Colors.primary} /></View>
      </View>

      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue your cultural journey.</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username or Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
            <TextInput style={styles.input} placeholder="Enter username or email" placeholderTextColor={Colors.textTertiary}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <Pressable onPress={() => router.push('/(onboarding)/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
            <TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor={Colors.textTertiary}
              value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
        <View style={[styles.rememberCheckbox, rememberMe && styles.rememberChecked]}>
          {rememberMe && <Ionicons name="checkmark" size={12} color="#FFF" />}
        </View>
        <Text style={styles.rememberText}>Remember me</Text>
      </Pressable>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        rightIcon="arrow-forward"
        loading={loading}
        disabled={!isValid || loading}
        onPress={handleLogin}
        style={styles.submitBtn}
      >
        Sign In
      </Button>

      <View style={styles.socialDivider}>
        <View style={styles.divLine} />
        <Text style={styles.divText}>or</Text>
        <View style={styles.divLine} />
      </View>

      <View style={styles.socialRow}>
        <Pressable style={styles.socialButton} onPress={handleGoogleSignIn} disabled={loading}>
          <Ionicons name="logo-google" size={20} color="#DB4437" />
          <Text style={styles.socialBtnText}>Google</Text>
        </Pressable>
        <Pressable style={styles.socialButton} onPress={() => Alert.alert('Coming Soon', 'Apple sign-in is coming soon. Please use email and password.')} disabled={loading}>
          <Ionicons name="logo-apple" size={20} color={Colors.text} />
          <Text style={styles.socialBtnText}>Apple</Text>
        </Pressable>
      </View>

      <Pressable style={styles.switchRow} onPress={() => router.replace('/(onboarding)/signup')}>
        <Text style={styles.switchText}>Don&apos;t have an account? <Text style={styles.switchLink}>Sign Up</Text></Text>
      </Pressable>
    </ScrollView>
  );

  // Desktop web: centred card on full-screen gradient
  if (isDesktop) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <View style={[styles.container, styles.desktopWrapper]}>
          <LinearGradient
            colors={['#001F4D', '#0081C8', '#EE334E', '#FCB131']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.95 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Back to landing */}
          <View style={styles.desktopBackRow}>
            <Pressable onPress={() => router.replace('/landing')} hitSlop={8} style={styles.desktopBackBtn}>
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              <Text style={styles.desktopBackText}>Back to Home</Text>
            </Pressable>
          </View>
          <View style={styles.desktopCard}>
            {formContent}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.container, { paddingTop: topInset }]}>
        <LinearGradient
          colors={['#001F4D', '#0081C8', '#EE334E', '#FCB131']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.95 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></Pressable>
        </View>
        {formContent}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001F4D' },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  desktopWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopBackRow: {
    position: 'absolute',
    top: 20,
    left: 32,
    zIndex: 10,
  },
  desktopBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  desktopBackText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: '#fff' },
  desktopCard: {
    width: 480,
    maxHeight: '90%' as unknown as number,
    backgroundColor: 'rgba(0,31,77,0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0,0,0,0.45)' } as object : {}),
  },
  logoRow: { alignItems: 'center', marginTop: 12, marginBottom: 28 },
  logoCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontFamily: 'Poppins_700Bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 8, letterSpacing: 0.37 },
  subtitle: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  errorText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.error, textAlign: 'center', marginBottom: 16, backgroundColor: Colors.error + '15', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  form: { gap: 20, marginBottom: 20 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#FFE066' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  input: { flex: 1, fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#1A1A1A' },
  submitBtn: { marginBottom: 28 },
  socialDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  divText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  socialButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  socialBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#1A1A1A' },
  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
  switchLink: { color: '#FFE066', fontFamily: 'Poppins_600SemiBold' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  rememberCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  rememberChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rememberText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
});
