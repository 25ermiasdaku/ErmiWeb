/**
 * Cart — review the basket and send the order.
 *
 * The server recomputes every price from the item and option ids, so the total
 * shown here is a preview, not a promise. A signed-in customer can spend
 * points on a reward they can afford; a signed-out one is pointed at sign-in.
 */
import { Link, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getRewards, placeOrder, type Reward } from "@/api";
import { EmptyState } from "@/components/ScreenState";
import { money } from "@/format";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { colors, radius, shared, spacing } from "@/theme";

export default function CartScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { lines, setQty, remove, clear, subtotalCents, count } = useCart();

  const [note, setNote] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardId, setRewardId] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);

  // Rewards only matter to a signed-in member; the pool is filtered to what the
  // current balance can actually afford.
  useEffect(() => {
    let active = true;
    if (!token) {
      setRewards([]);
      return;
    }
    (async () => {
      try {
        const list = await getRewards();
        if (active) setRewards(list);
      } catch {
        if (active) setRewards([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const affordable = useMemo(
    () => rewards.filter((reward) => (user?.points ?? 0) >= reward.pointsCost),
    [rewards, user],
  );

  if (!token) {
    return (
      <View style={styles.signIn}>
        <Text style={shared.h2}>Sign in to check out</Text>
        <Text style={shared.muted}>
          Your basket is saved on this device. Sign in so we can bank the points and track the
          order.
        </Text>
        <Link href="/login" asChild>
          <Pressable style={shared.button}>
            <Text style={shared.buttonText}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (count === 0) {
    return (
      <View style={shared.screen}>
        <EmptyState message="Your cup is empty. Add something from the menu." />
        <View style={styles.emptyAction}>
          <Link href="/(tabs)/menu" asChild>
            <Pressable style={shared.buttonGhost}>
              <Text style={shared.buttonTextGhost}>Browse the menu</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  const submit = async () => {
    setPlacing(true);
    try {
      const result = await placeOrder(token, {
        lines: lines.map((line) => ({
          itemId: line.itemId,
          qty: line.qty,
          optionIds: line.options.map((option) => option.id),
        })),
        note: note.trim(),
        rewardId,
      });
      if (!result.ok) {
        Alert.alert("Could not place the order", result.message);
        return;
      }
      clear();
      setNote("");
      setRewardId(null);
      Alert.alert("Order placed", result.message, [
        { text: "Track it", onPress: () => router.replace("/(tabs)/orders") },
      ]);
    } catch (err) {
      Alert.alert("Could not place the order", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      {lines.map((line) => (
        <View key={line.key} style={shared.card}>
          <View style={shared.between}>
            <Text style={shared.h2}>
              {line.icon} {line.name}
            </Text>
            <Pressable onPress={() => remove(line.key)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
          {line.options.length > 0 ? (
            <Text style={shared.muted}>
              {line.options.map((option) => option.label).join(", ")}
            </Text>
          ) : null}
          <View style={shared.between}>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepButton}
                onPress={() => setQty(line.key, line.qty - 1)}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{line.qty}</Text>
              <Pressable
                style={styles.stepButton}
                onPress={() => setQty(line.key, line.qty + 1)}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
            <Text style={shared.h3}>{money(line.unitPriceCents * line.qty)}</Text>
          </View>
        </View>
      ))}

      <View style={shared.card}>
        <Text style={shared.label}>Note for the bar</Text>
        <TextInput
          style={[shared.input, styles.noteInput]}
          placeholder="Anything we should know?"
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={setNote}
          multiline
        />
      </View>

      <View style={shared.card}>
        <Text style={shared.label}>Rewards</Text>
        {affordable.length === 0 ? (
          <Text style={shared.muted}>
            Nothing you can redeem yet — you have {user?.points ?? 0} points.
          </Text>
        ) : (
          <>
            <Pressable
              style={[styles.reward, rewardId === null && styles.rewardActive]}
              onPress={() => setRewardId(null)}
            >
              <Text style={[shared.body, rewardId === null && styles.rewardTextActive]}>
                No reward
              </Text>
            </Pressable>
            {affordable.map((reward) => {
              const active = rewardId === reward.id;
              return (
                <Pressable
                  key={reward.id}
                  style={[styles.reward, active && styles.rewardActive]}
                  onPress={() => setRewardId(reward.id)}
                >
                  <View style={shared.between}>
                    <Text style={[shared.body, active && styles.rewardTextActive]}>
                      {reward.name}
                    </Text>
                    <Text style={[shared.muted, active && styles.rewardTextActive]}>
                      {reward.pointsCost} pts
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </View>

      <View style={shared.card}>
        <View style={shared.between}>
          <Text style={shared.h3}>Subtotal</Text>
          <Text style={shared.h2}>{money(subtotalCents)}</Text>
        </View>
        <Text style={shared.muted}>Tax is added when the order is placed.</Text>
        <Pressable
          style={[shared.buttonAlt, placing && shared.disabled]}
          disabled={placing}
          onPress={() => void submit()}
        >
          <Text style={shared.buttonText}>{placing ? "Placing…" : "Place order"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  signIn: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyAction: { padding: spacing.lg },
  remove: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
  },
  stepButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  stepText: { fontSize: 18, color: colors.espresso, fontWeight: "700" },
  qty: { minWidth: 24, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.ink },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  reward: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.paper,
  },
  rewardActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  rewardTextActive: { color: colors.cream },
});
