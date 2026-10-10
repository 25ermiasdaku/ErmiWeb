/**
 * Shared loading, error and empty states.
 *
 * Every screen fetches over the network, so every screen needs to say "wait",
 * "that failed, try again" and "nothing here yet" the same way. Keeping them
 * here stops each screen from inventing its own spinner copy.
 */
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, shared, spacing } from "@/theme";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.caramel} size="large" />
      <Text style={shared.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={shared.h3}>Something went wrong</Text>
      <Text style={[shared.muted, styles.centerText]}>{message}</Text>
      {onRetry ? (
        <Pressable style={shared.button} onPress={onRetry}>
          <Text style={shared.buttonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={[shared.muted, styles.centerText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  centerText: { textAlign: "center" },
});
