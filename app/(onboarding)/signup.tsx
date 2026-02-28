import { View, Text, Pressable, StyleSheet, TextInput, Platform, KeyboardAvoidingView, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { auth as firebaseAuth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { apiRequest } from '@/lib/query-client';
import { Button } from '@/components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isValid = name.trim().length > 1 && email.includes('@') && password.length >= 6 && agreed;

  const handleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });

      // Create Firestore user profile (fire-and-forget — non-blocking)
      credential.user.getIdToken().then((idToken) => {
        apiRequest(
          'POST',
          'api/auth/register',
          { displayName: name.trim() },
          { headers: { Authorization: `Bearer ${idToken}` } }
        ).catch(() => { /* profile created lazily by GET /api/auth/me on next load */ });
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/location');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError('Registration failed. Please try again.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.benefitsRow}>Free events · Community access · Exclusive perks</Text>
          <Text style={styles.subtitle}>Join thousands of community members celebrating culture together.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
                <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor={Colors.textTertiary}
                  value={name} onChangeText={setName} autoCapitalize="words" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={Colors.textTertiary}
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                <TextInput style={styles.input} placeholder="Min. 6 characters" placeholderTextColor={Colors.textTertiary}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
              {password.length > 0 && password.length < 6 && <Text style={styles.hint}>Password must be at least 6 characters</Text>}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBg}>
                    <View style={[
                      styles.strengthBarFill,
                      {
                        width: password.length < 6 ? '33%' : password.length < 10 ? '66%' : '100%',
                        backgroundColor: password.length < 6 ? Colors.error : password.length < 10 ? Colors.warning : Colors.success,
                      },
                    ]} />
                  </View>
                  <Text style={[
                    styles.strengthLabel,
                    { color: password.length < 6 ? Colors.error : password.length < 10 ? Colors.warning : Colors.success },
                  ]}>
                    {password.length < 6 ? 'Weak' : password.length < 10 ? 'Medium' : 'Strong'}
                  </Text>
                </View>
              )}
            </View>

            <Pressable style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.checkText}>I agree to the <Text style={styles.linkText}>Terms of Service</Text> and <Text style={styles.linkText}>Privacy Policy</Text></Text>
            </Pressable>
          </View>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            rightIcon="arrow-forward"
            loading={loading}
            disabled={!isValid || loading}
            onPress={handleSignUp}
            style={styles.submitBtn}
          >
            Create Account
          </Button>

          <Pressable style={styles.switchRow} onPress={() => router.replace('/(onboarding)/login')}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign In</Text></Text>
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
          <View style={styles.desktopBackRow}>
            <Pressable onPress={() => router.replace('/get2know')} hitSlop={8} style={styles.desktopBackBtn}>
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
  title: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 22, marginBottom: 28 },
  errorText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.error, textAlign: 'center', marginBottom: 16, backgroundColor: Colors.error + '15', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  form: { gap: 20, marginBottom: 28 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  input: { flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#1A1A1A' },
  hint: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: '#FFE066', marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkText: { flex: 1, fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  linkText: { color: '#FFE066', fontFamily: 'Poppins_600SemiBold' },
  submitBtn: { marginBottom: 16 },
  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
  switchLink: { color: '#FFE066', fontFamily: 'Poppins_600SemiBold' },
  benefitsRow: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  strengthBarFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
  desktopWrapper: { alignItems: 'center', justifyContent: 'center' },
  desktopBackRow: { position: 'absolute', top: 20, left: 32, zIndex: 10 },
  desktopBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  desktopBackText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: '#fff' },
  desktopCard: {
    width: 480,
    backgroundColor: 'rgba(0,31,77,0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0,0,0,0.45)' } as object : {}),
  },
});
