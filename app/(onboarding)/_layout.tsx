import { Stack, Redirect } from "expo-router";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ActivityIndicator, View } from "react-native";

export default function OnboardingLayout() {
  const { state, isLoading } = useOnboarding();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A1628' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Already completed onboarding (authenticated + location set) → go straight to Discovery
  if (state.isComplete) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="location" />
      <Stack.Screen name="communities" />
      <Stack.Screen name="interests" />
    </Stack>
  );
}
