/**
 * The root of the native app.
 *
 * Providers wrap everything in the order they need each other: safe-area for
 * layout, auth for the session, cart for the basket. The Stack supplies the
 * themed header every pushed screen inherits, and the tab group declares its
 * own (`headerShown: false`) so it does not sit under a second one.
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/store/auth";
import { CartProvider } from "@/store/cart";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.espresso },
              headerTintColor: colors.cream,
              headerTitleStyle: { fontWeight: "700" },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.cream },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: "Sign in" }} />
            <Stack.Screen name="register" options={{ title: "Create account" }} />
            <Stack.Screen name="item/[id]" options={{ title: "Customise" }} />
          </Stack>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
