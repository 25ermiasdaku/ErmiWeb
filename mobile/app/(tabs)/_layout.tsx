/**
 * The five bottom tabs.
 *
 * Labels are plain text and the "icons" are emoji in a Text node, so the app
 * needs no icon font. The cart tab carries the live item count as a badge.
 */
import { Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { useCart } from "@/store/cart";
import { colors } from "@/theme";

function TabEmoji({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { count } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.espresso },
        headerTintColor: colors.cream,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.caramel,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabEmoji emoji="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => <TabEmoji emoji="☕" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color }) => <TabEmoji emoji="🛍️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <TabEmoji emoji="🧾" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabEmoji emoji="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
