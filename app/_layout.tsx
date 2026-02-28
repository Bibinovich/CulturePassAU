import 'react-native-reanimated'; // <-- CRUCIAL FIX: Must be at the very top

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect } from "react";
import { Platform, View, StyleSheet, useWindowDimensions, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { ContactsProvider } from "@/contexts/ContactsContext";
import { Breakpoints, Colors } from "@/constants/theme";

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

// Prevent splash auto-hide safely
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: "Back",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="get2know" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="community/[id]" />
      <Stack.Screen name="business/[id]" />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="venue/[id]" />
      <Stack.Screen name="user/[id]" />

      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="profile/public" />
      <Stack.Screen name="profile/qr" />

      <Stack.Screen name="movies/index" />
      <Stack.Screen name="movies/[id]" />
      <Stack.Screen name="restaurants/index" />
      <Stack.Screen name="restaurants/[id]" />
      <Stack.Screen name="activities/index" />
      <Stack.Screen name="activities/[id]" />
      <Stack.Screen name="shopping/index" />
      <Stack.Screen name="shopping/[id]" />
      <Stack.Screen name="communities/index" />

      <Stack.Screen name="payment/methods" />
      <Stack.Screen name="payment/transactions" />
      <Stack.Screen name="payment/wallet" />
      <Stack.Screen name="payment/success" />
      <Stack.Screen name="payment/cancel" />

      <Stack.Screen name="tickets/index" />
      <Stack.Screen name="tickets/[id]" />
      <Stack.Screen name="tickets/print/[id]" />
      <Stack.Screen name="perks/index" />
      <Stack.Screen name="perks/[id]" />
      <Stack.Screen name="notifications/index" />

      <Stack.Screen name="contacts/index" />
      <Stack.Screen name="contacts/[cpid]" />
      <Stack.Screen name="scanner" />

      <Stack.Screen name="search/index" />
      <Stack.Screen name="saved/index" />
      <Stack.Screen name="submit/index" />
      <Stack.Screen name="allevents" />
      <Stack.Screen name="map" />
      <Stack.Screen name="membership/upgrade" />

      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/about" />
      <Stack.Screen name="settings/help" />
      <Stack.Screen name="settings/notifications" />
      <Stack.Screen name="settings/privacy" />
      <Stack.Screen name="dashboard/organizer" />

      <Stack.Screen name="help/index" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/cookies" />
      <Stack.Screen name="legal/guidelines" />
    </Stack>
  );
}

/**
 * Responsive web wrapper
 */
function WebShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const isDesktop = width >= Breakpoints.desktop;
  const isTablet = width >= Breakpoints.tablet && !isDesktop;

  if (isDesktop) {
    return (
      <View style={[webStyles.outerContainer, webStyles.outerFull, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <LinearGradient
          colors={
            isDark
              ? (["#05070D", "#101522", "#070A12"] as [string, string, string])
              : (["#F8FAFF", "#EFF4FF", "#F8F5EF"] as [string, string, string])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ flex: 1, width: '100%' }}>
          {children}
        </View>
      </View>
    );
  }

  const maxWidth = isTablet
    ? Math.min(900, width - 40)
    : Math.min(520, width - 20);

  return (
    <View style={[webStyles.outerContainer, { backgroundColor: isDark ? Colors.dark.background : "#ECEFF5" }]}>
      <LinearGradient
        colors={
          isDark
            ? (["#05070D", "#101522", "#070A12"] as [string, string, string])
            : (["#F8FAFF", "#EFF4FF", "#F8F5EF"] as [string, string, string])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          webStyles.glowOrb,
          webStyles.glowOrbTop,
          { backgroundColor: isDark ? "rgba(88, 86, 214, 0.25)" : "rgba(0, 122, 255, 0.14)" },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          webStyles.glowOrb,
          webStyles.glowOrbBottom,
          { backgroundColor: isDark ? "rgba(10, 132, 255, 0.18)" : "rgba(255, 149, 0, 0.12)" },
        ]}
      />
      <View
        style={[
          webStyles.innerContainer,
          { maxWidth },
          (isTablet ? webStyles.desktopShell : webStyles.phoneShell) as object,
          {
            backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(9,30,66,0.08)",
            borderRadius: isTablet ? 20 : 16,
            marginVertical: isTablet ? 12 : 0,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const isWeb = Platform.OS === 'web';

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <OnboardingProvider>
            <AuthProvider>
              <SavedProvider>
                <ContactsProvider>
                  <GestureHandlerRootView
                    style={{ flex: 1 }}
                    onLayout={onLayoutRootView}
                  >
                    {isWeb ? (
                      <WebShell>
                        {/* 🚨 KeyboardProvider removed for Web to prevent Reanimated crashes */}
                        <RootLayoutNav />
                      </WebShell>
                    ) : (
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    )}
                  </GestureHandlerRootView>
                </ContactsProvider>
              </SavedProvider>
            </AuthProvider>
          </OnboardingProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const webStyles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  outerFull: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  phoneShell: (Platform.OS === 'web'
    ? { boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }
    : {}) as object,
  desktopShell: (Platform.OS === 'web'
    ? { boxShadow: '0 20px 55px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }
    : {}) as object,
  glowOrb: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
  },
  glowOrbTop: {
    top: -160,
    right: -120,
  },
  glowOrbBottom: {
    bottom: -220,
    left: -160,
  },
});