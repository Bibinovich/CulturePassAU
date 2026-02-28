import React from "react";
import { Platform, StyleSheet, View, useWindowDimensions, useColorScheme, Animated } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useRole } from "@/hooks/useRole";
import { TabBarTokens, gradients } from "@/constants/theme";
import { WebSidebar } from "@/components/web/WebSidebar";

// ---------------------------------------------------------------------------
// Animated tab icon — scale + opacity pulse + active indicator dot
// ---------------------------------------------------------------------------
interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}

function AnimatedTabIcon({ name, focused, color, size }: TabIconProps) {
  const scale = React.useRef(new Animated.Value(focused ? 1.1 : 0.9)).current;
  const opacity = React.useRef(new Animated.Value(focused ? 1 : 0.6)).current;
  const dotOpacity = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.1 : 0.9, damping: 15, stiffness: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: focused ? 1 : 0.6, duration: 180, useNativeDriver: true }),
      Animated.timing(dotOpacity, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused, scale, opacity, dotOpacity]);

  return (
    <View style={tabStyles.iconWrapper}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
      <Animated.View style={[tabStyles.dot, { backgroundColor: color, opacity: dotOpacity }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab layout
// ---------------------------------------------------------------------------
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index:       ["compass",       "compass-outline"],
  calendar:    ["calendar",      "calendar-outline"],
  communities: ["people",        "people-outline"],
  perks:       ["gift",          "gift-outline"],
  profile:     ["person-circle", "person-circle-outline"],
  dashboard:   ["grid",          "grid-outline"],
};

// Shared tab screen definitions used in both desktop and mobile layouts
function TabScreens({ isOrganizer }: { isOrganizer: boolean }) {
  return (
    <>
      <Tabs.Screen name="index"       options={{ title: "Discover" }} />
      <Tabs.Screen name="calendar"    options={{ title: "Calendar" }} />
      <Tabs.Screen name="communities" options={{ title: "Community" }} />
      <Tabs.Screen name="perks"       options={{ title: "Perks" }} />
      <Tabs.Screen name="dashboard"   options={{ title: "Dashboard", href: isOrganizer ? undefined : null }} />
      <Tabs.Screen name="explore"     options={{ href: null }} />
      <Tabs.Screen name="directory"   options={{ href: null }} />
      <Tabs.Screen name="profile"     options={{ title: "Profile" }} />
    </>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const scheme = useColorScheme();
  const { isOrganizer } = useRole();
  const isDark = scheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const isDesktop = isWeb && width >= 1024;

  // Desktop web: sidebar replaces the bottom tab bar
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <WebSidebar />
        <View style={{ flex: 1, overflow: "hidden" }}>
          <Tabs
            tabBar={() => null}
            screenOptions={{ headerShown: false }}
          >
            <TabScreens isOrganizer={isOrganizer} />
          </Tabs>
        </View>
      </View>
    );
  }

  const tabBarHeight = TabBarTokens.heightMobile;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? "#636366" : "#8E8E93",
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: "transparent",
          height: tabBarHeight,
        },
        tabBarBackground: () => (
          <>
            {isIOS ? (
              <BlurView
                intensity={85}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: isDark
                      ? "rgba(10,10,12,0.93)"
                      : "rgba(255,255,255,0.93)",
                  },
                ]}
              />
            )}
            {/* Gradient accent line along the top edge */}
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={tabStyles.topAccent}
            />
          </>
        ),
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: TabBarTokens.labelSize,
          marginTop: -2,
        },
        tabBarItemStyle: isWeb ? ({ cursor: "pointer" } as object) : undefined,
        tabBarIcon: ({ color, size, focused }) => {
          const [active, inactive] = ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
          return (
            <AnimatedTabIcon
              name={focused ? active : inactive}
              focused={focused}
              color={color}
              size={size}
            />
          );
        },
      })}
    >
      <TabScreens isOrganizer={isOrganizer} />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.55,
  },
});
