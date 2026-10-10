/**
 * Account — who you are, and what your points are worth.
 *
 * Points come live from the server on every focus, so the balance shown under
 * the cart stays right. The reward list is filtered to what the current
 * balance can afford, the same pool the cart offers.
 */
import { Link, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteAccount, getRewards, type Reward } from "@/api";
import { Loading } from "@/components/ScreenState";
import { money } from "@/format";
import { useAuth } from "@/store/auth";
import { colors, radius, shared, spacing } from "@/theme";

export default function AccountScreen() {
  const { token, user, loading, refresh, signOut } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let active = true;
      (async () => {
        try {
          await refresh();
        } catch (err) {
          if (active) Alert.alert("Could not refresh", err instanceof Error ? err.message : "Try again.");
        }
      })();
      return () => {
        active = false;
      };
    }, [token, refresh]),
  );

  useEffect(() => {
    let active = true;
    if (!token) return;
    (async () => {
      try {
        const list = await getRewards();
        if (active) {
          setRewards(list);
          setRewardsError(null);
        }
      } catch (err) {
        if (active) setRewardsError(err instanceof Error ? err.message : "Rewards unavailable.");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) return <Loading label="Opening your account…" />;

  if (!token || !user) {
    return (
      <View style={styles.centered}>
        <Text style={shared.h2}>Welcome to the reward side</Text>
        <Text style={[shared.muted, styles.centerText]}>
          Sign in to see your points, spend rewards and follow your orders.
        </Text>
        <Link href="/login" asChild>
          <Pressable style={shared.button}>
            <Text style={shared.buttonText}>Sign in</Text>
          </Pressable>
        </Link>
        <Link href="/register" asChild>
          <Pressable style={shared.buttonGhost}>
            <Text style={shared.buttonTextGhost}>Create account</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const affordable = rewards.filter((reward) => user.points >= reward.pointsCost);

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Member</Text>
        <Text style={styles.heroName}>{user.fullName}</Text>
        <Text style={styles.heroDetail}>{user.email}</Text>
        <Text style={styles.heroPoints}>{user.points} pts</Text>
      </View>

      <View style={shared.card}>
        <Text style={shared.label}>Your rewards</Text>
        {rewardsError ? <Text style={shared.muted}>{rewardsError}</Text> : null}
        {rewards.length === 0 && !rewardsError ? (
          <Text style={shared.muted}>The reward shelf is being restocked.</Text>
        ) : null}
        {affordable.map((reward) => (
          <View key={reward.id} style={styles.rewardRow}>
            <View style={styles.rewardText}>
              <Text style={shared.body}>{reward.name}</Text>
              <Text style={shared.muted}>{reward.description}</Text>
            </View>
            <Text style={styles.rewardCost}>
              {reward.pointsCost} pts · {money(reward.valueCents)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[shared.muted, styles.balanceHint]}>
        Every dollar you spend earns a point, banked when you confirm collection. More rewards open
        up as the balance climbs.
      </Text>

      <Pressable
        style={shared.buttonGhost}
        onPress={() => {
          Alert.alert("Sign out?", "You can sign straight back in.", [
            { text: "Stay", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
          ]);
        }}
      >
        <Text style={shared.buttonTextGhost}>Sign out</Text>
      </Pressable>

      {/* Danger zone: erase your own account, nobody else's. */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={shared.muted}>
          Permanently erases your account and its loyalty record. Your past orders stay in the
          history but are unlinked. This cannot be undone.
        </Text>
        <TextInput
          style={shared.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
        />
        {deleteError ? <Text style={styles.dangerError}>{deleteError}</Text> : null}
        <Pressable
          style={[styles.dangerButton, (deleting || password.length === 0) && shared.disabled]}
          disabled={deleting || password.length === 0}
          onPress={() => {
            Alert.alert(
              "Delete your account?",
              "This permanently erases your account and its loyalty record. Your past orders stay in the history but are unlinked. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: () =>
                    void (async () => {
                      if (!token) return;
                      setDeleting(true);
                      setDeleteError(null);
                      try {
                        await deleteAccount(token, password);
                        await signOut();
                        Alert.alert(
                          "Account deleted",
                          "Your account and its record were erased. You can always register again.",
                        );
                      } catch (err) {
                        setDeleting(false);
                        setDeleteError(
                          err instanceof Error ? err.message : "Could not delete the account. Try again.",
                        );
                        setPassword("");
                      }
                    })(),
                },
              ],
            );
          }}
        >
          <Text style={styles.dangerButtonText}>{deleting ? "Deleting…" : "Delete my account"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  centerText: { textAlign: "center" },
  hero: {
    backgroundColor: colors.espresso,
    borderRadius: 18,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  heroKicker: {
    color: colors.caramel,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroName: { color: colors.cream, fontSize: 24, fontWeight: "700" },
  heroDetail: { color: colors.creamDark, fontSize: 14 },
  heroPoints: { color: colors.caramel, fontSize: 28, fontWeight: "700", marginTop: spacing.sm },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardText: { flex: 1, gap: 2 },
  rewardCost: { fontSize: 12, color: colors.mocha, fontWeight: "600" },
  balanceHint: { paddingHorizontal: spacing.xs },
  dangerZone: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.paper,
  },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  dangerError: { color: colors.danger, fontSize: 12 },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
});