/**
 * Item detail — configure one drink.
 *
 * Options are single-select per group (size, milk, extras), matching the
 * groups the till uses. The price updates live and the configured line is
 * handed to the cart, which re-keys it so two different builds stay apart.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMenu, type MenuItem, type MenuOption } from "@/api";
import { ErrorState, Loading } from "@/components/ScreenState";
import { money } from "@/format";
import { useCart } from "@/store/cart";
import { colors, radius, shared, spacing } from "@/theme";

/** Group the flat option list by `groupName`, preserving first-seen order. */
function groupOptions(options: MenuOption[]): Array<{ group: string; options: MenuOption[] }> {
  const groups: Array<{ group: string; options: MenuOption[] }> = [];
  for (const option of options) {
    const group = groups.find((entry) => entry.group === option.groupName);
    if (group) group.options.push(option);
    else groups.push({ group: option.groupName, options: [option] });
  }
  return groups;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { add } = useCart();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [qty, setQty] = useState(1);

  const itemId = Number(id);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const menu = await getMenu();
      setItem(menu.find((entry) => entry.id === itemId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, [itemId]);

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

  const groups = useMemo(() => (item ? groupOptions(item.options) : []), [item]);

  // Seed one choice per group: its default if it has one, otherwise the first.
  useEffect(() => {
    if (!item) return;
    const initial: Record<string, number> = {};
    for (const group of groupOptions(item.options)) {
      const preferred = group.options.find((option) => option.isDefault) ?? group.options[0];
      if (preferred) initial[group.group] = preferred.id;
    }
    setSelection(initial);
    setQty(1);
  }, [item]);

  const chosen = useMemo<MenuOption[]>(() => {
    if (!item) return [];
    return item.options.filter((option) => selection[option.groupName] === option.id);
  }, [item, selection]);

  const unitPriceCents = useMemo(
    () => (item ? item.basePriceCents + chosen.reduce((sum, option) => sum + option.priceDeltaCents, 0) : 0),
    [item, chosen],
  );

  if (loading) return <Loading label="Loading the drink…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!item) return <ErrorState message="That drink is no longer on the menu." />;

  return (
    <View style={shared.screen}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={shared.h1}>{item.name}</Text>
          <Text style={shared.body}>{item.description}</Text>
          <Text style={shared.muted}>
            {[item.roast !== "-" ? `${item.roast} roast` : null, item.origin, item.notes]
              .filter((part): part is string => Boolean(part))
              .join(" · ")}
          </Text>
        </View>

        {groups.map((group) => (
          <View key={group.group} style={styles.group}>
            <Text style={shared.label}>{group.group}</Text>
            <View style={styles.optionList}>
              {group.options.map((option) => {
                const active = selection[group.group] === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() =>
                      setSelection((prev) => ({ ...prev, [group.group]: option.id }))
                    }
                  >
                    <Text style={[shared.body, active && styles.optionTextActive]}>
                      {option.label}
                    </Text>
                    <Text style={[shared.muted, active && styles.optionTextActive]}>
                      {option.priceDeltaCents === 0
                        ? "Included"
                        : `+${money(option.priceDeltaCents)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setQty((value) => Math.max(1, value - 1))}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.qty}>{qty}</Text>
          <Pressable style={styles.stepButton} onPress={() => setQty((value) => value + 1)}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <Pressable
          style={[shared.buttonAlt, styles.addButton]}
          onPress={() => {
            add(item, chosen, qty);
            router.back();
          }}
        >
          <Text style={shared.buttonText}>
            Add {qty} · {money(unitPriceCents * qty)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  icon: { fontSize: 34 },
  group: { gap: spacing.sm },
  optionList: { gap: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  optionTextActive: { color: colors.cream },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
  },
  stepButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  stepText: { fontSize: 20, color: colors.espresso, fontWeight: "700" },
  qty: { minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.ink },
  addButton: { flex: 1 },
});
