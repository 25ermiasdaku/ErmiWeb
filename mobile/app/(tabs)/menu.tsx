/**
 * Menu — the catalogue.
 *
 * The same `menu_items` table the till reads, so a drink edited at the counter
 * shows up here. Filter by free text, category and roast; tap a drink to
 * configure it.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getMenu, type MenuItem } from "@/api";
import { ErrorState, Loading } from "@/components/ScreenState";
import { money } from "@/format";
import { colors, shared, spacing } from "@/theme";

const ALL = "All";

export default function MenuScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [roast, setRoast] = useState(ALL);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await getMenu());
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

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) if (item.categoryName) seen.add(item.categoryName);
    return [ALL, ...Array.from(seen)];
  }, [items]);

  const roasts = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) if (item.roast && item.roast !== "-") seen.add(item.roast);
    return [ALL, ...Array.from(seen)];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== ALL && item.categoryName !== category) return false;
      if (roast !== ALL && item.roast !== roast) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.notes.toLowerCase().includes(needle)
      );
    });
  }, [items, query, category, roast]);

  if (loading) return <Loading label="Loading the menu…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={shared.screen}>
      <View style={styles.filters}>
        <TextInput
          style={shared.input}
          placeholder="Search drinks and notes"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        <ChipRow
          options={categories}
          selected={category}
          onSelect={setCategory}
          label="Category"
        />
        {roasts.length > 1 ? (
          <ChipRow options={roasts} selected={roast} onSelect={setRoast} label="Roast" />
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[shared.muted, styles.empty]}>Nothing matches those filters.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={shared.card}
            onPress={() => router.push({ pathname: "/item/[id]", params: { id: String(item.id) } })}
          >
            <View style={shared.between}>
              <Text style={shared.h2}>
                {item.icon} {item.name}
              </Text>
              <Text style={shared.h3}>{money(item.basePriceCents)}</Text>
            </View>
            <Text style={shared.body}>{item.description}</Text>
            <Text style={shared.muted}>
              {[item.roast !== "-" ? `${item.roast} roast` : null, item.origin, item.notes]
                .filter((part): part is string => Boolean(part))
                .join(" · ")}
            </Text>
            {item.isSignature ? <Text style={styles.signature}>Signature</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
  label,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  label: string;
}) {
  return (
    <View style={styles.chipRow}>
      <Text style={shared.label}>{label}</Text>
      <View style={shared.wrap}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              style={[shared.pill, active && shared.pillActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[shared.pillText, active && shared.pillTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.creamDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { textAlign: "center", paddingVertical: spacing.xxl },
  chipRow: { gap: spacing.sm },
  signature: { color: colors.caramelDark, fontSize: 12, fontWeight: "700" },
});
