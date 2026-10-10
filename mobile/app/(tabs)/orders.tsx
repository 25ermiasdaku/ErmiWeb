/**
 * Orders — the customer's own tickets.
 *
 * Two-sided handshake: the customer confirms a pending order (the cafe then
 * starts it), and confirms collection once it is ready, which is when points
 * are banked. A pending order can still be withdrawn. Ownership is the account,
 * so this list is only ever your coffee.
 */
import { Link, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getMyOrders, updateOrder, type Order } from "@/api";
import { EmptyState, ErrorState, Loading } from "@/components/ScreenState";
import { dateTime, money, STATUS_COPY } from "@/format";
import { useAuth } from "@/store/auth";
import { colors, radius, shared, spacing } from "@/theme";

export default function OrdersScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setOrders(await getMyOrders(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!token) {
        setLoading(false);
        return;
      }
      (async () => {
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [token, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const act = useCallback(
    async (order: Order, action: "confirm" | "cancel") => {
      if (!token) return;
      setBusyId(order.id);
      try {
        const result = await updateOrder(token, order.id, action);
        Alert.alert(result.ok ? "Done" : "Not just yet", result.message);
        await load();
      } catch (err) {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [token, load],
  );

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={shared.h2}>Your orders live here</Text>
        <Text style={[shared.muted, styles.centerText]}>
          Sign in to place an order and follow it from the bar to your hands.
        </Text>
        <Link href="/login" asChild>
          <Pressable style={shared.button}>
            <Text style={shared.buttonText}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (loading) return <Loading label="Fetching your orders…" />;
  if (error) return <ErrorState message={error} onRetry={() => void onRefresh()} />;

  return (
    <FlatList
      style={shared.screen}
      data={orders}
      keyExtractor={(order) => String(order.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.caramel} />
      }
      ListEmptyComponent={<EmptyState message="No orders yet — your first cup is waiting." />}
      renderItem={({ item: order }) => {
        const copy = STATUS_COPY[order.status];
        const busy = busyId === order.id;
        return (
          <View style={shared.card}>
            <View style={shared.between}>
              <Text style={shared.h3}>{order.orderNumber}</Text>
              <Text style={[styles.status, { color: copy.tone, borderColor: copy.tone }]}>
                {copy.label}
              </Text>
            </View>
            <Text style={shared.muted}>{dateTime(order.createdAt)}</Text>

            {order.items.map((line, index) => (
              <View key={`${order.id}-${index}`} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={shared.body}>
                    {line.qty}× {line.name}
                  </Text>
                  {line.options.length > 0 ? (
                    <Text style={shared.muted}>{line.options.join(", ")}</Text>
                  ) : null}
                </View>
                <Text style={shared.body}>{money(line.lineTotalCents)}</Text>
              </View>
            ))}

            <View style={shared.divider} />
            <View style={shared.between}>
              <Text style={shared.muted}>
                {order.pointsEarned > 0 ? `Earns ${order.pointsEarned} pts` : "Points on collection"}
              </Text>
              <Text style={shared.h3}>{money(order.totalCents)}</Text>
            </View>

            <Text style={shared.muted}>{copy.description}</Text>

            {copy.action ? (
              <Pressable
                style={[shared.buttonAlt, busy && shared.disabled]}
                disabled={busy}
                onPress={() => void act(order, copy.action ?? "confirm")}
              >
                <Text style={shared.buttonText}>
                  {busy ? "Working…" : copy.actionLabel}
                </Text>
              </Pressable>
            ) : null}
            {copy.canCancel ? (
              <Pressable
                style={[shared.buttonGhost, busy && shared.disabled]}
                disabled={busy}
                onPress={() => void act(order, "cancel")}
              >
                <Text style={shared.buttonTextGhost}>Cancel order</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  centerText: { textAlign: "center" },
  list: { padding: spacing.lg, gap: spacing.md },
  status: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    overflow: "hidden",
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  itemMain: { flex: 1 },
});
