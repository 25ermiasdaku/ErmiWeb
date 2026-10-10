/**
 * Home — the first thing a customer sees.
 *
 * Seasonal promotions, the loyalty tiers and where to find us, all read from
 * the public endpoints. Pull to refresh re-fetches the lot.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLocations, getPromotions, type Location, type Promotion, type Tier } from "@/api";
import { ErrorState, Loading } from "@/components/ScreenState";
import { colors, radius, shared, spacing } from "@/theme";

export default function HomeScreen() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [promos, stores] = await Promise.all([getPromotions(), getLocations()]);
      setPromotions(promos.promotions);
      setTiers(promos.rewardTiers);
      setLocations(stores);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <Loading label="Brewing the shop…" />;
  if (error) return <ErrorState message={error} onRetry={() => void onRefresh()} />;

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.caramel} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Ermi Coffee</Text>
        <Text style={styles.heroTitle}>Order ahead. Earn as you sip.</Text>
        <Text style={styles.heroBody}>
          Skip the queue, track your points and pick up your usual without saying a word.
        </Text>
      </View>

      <Section title="This season">
        {promotions.map((promo) => (
          <View key={promo.id} style={shared.card}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{promo.badge}</Text>
            </View>
            <Text style={shared.h2}>{promo.title}</Text>
            <Text style={shared.body}>{promo.blurb}</Text>
            <Text style={shared.muted}>{promo.detail}</Text>
          </View>
        ))}
        {promotions.length === 0 ? <Text style={shared.muted}>No offers running right now.</Text> : null}
      </Section>

      <Section title="Loyalty">
        {tiers.map((tier) => (
          <View key={tier.name} style={shared.card}>
            <View style={shared.between}>
              <Text style={shared.h2}>{tier.name}</Text>
              <Text style={shared.muted}>{tier.min}</Text>
            </View>
            {tier.perks.map((perk) => (
              <Text key={perk} style={shared.body}>
                • {perk}
              </Text>
            ))}
          </View>
        ))}
      </Section>

      <Section title="Find us">
        {locations.map((store) => (
          <View key={`${store.name}-${store.address}`} style={shared.card}>
            <Text style={shared.h2}>{store.name}</Text>
            <Text style={shared.body}>
              {store.address} · {store.area}
            </Text>
            <Text style={shared.muted}>{store.hours}</Text>
            <Text style={shared.muted}>{store.note}</Text>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={shared.label}>{title}</Text>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.espresso,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroKicker: {
    color: colors.caramel,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: { color: colors.cream, fontSize: 24, fontWeight: "700" },
  heroBody: { color: colors.creamDark, fontSize: 14, lineHeight: 20 },
  section: { gap: spacing.sm },
  stack: { gap: spacing.md },
  badgeRow: { flexDirection: "row" },
  badge: {
    backgroundColor: colors.caramel,
    color: colors.espresso,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
