/**
 * The shop's palette and a handful of shared styles.
 *
 * Espresso browns, a cream page and a caramel accent, so every screen reads as
 * the same cafe. Screens reach for `shared` rather than inventing their own
 * spacing, and keep only layout that is genuinely local to themselves.
 */
import { StyleSheet } from "react-native";

export const colors = {
  espresso: "#2a1a12",
  espressoSoft: "#3d2a1e",
  mocha: "#6b4f3a",
  caramel: "#c98a3f",
  caramelDark: "#a5702c",
  cream: "#f7f1e6",
  creamDark: "#eadfce",
  paper: "#ffffff",
  ink: "#2c211a",
  muted: "#7c6c5d",
  line: "#e4d8c6",
  success: "#2f7d52",
  warning: "#b7791f",
  danger: "#b23a2e",
  info: "#2f6fb0",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, gap: spacing.lg },

  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  h1: { fontSize: 26, fontWeight: "700", color: colors.espresso },
  h2: { fontSize: 19, fontWeight: "700", color: colors.espresso },
  h3: { fontSize: 15, fontWeight: "700", color: colors.espressoSoft },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 18, color: colors.muted },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.mocha,
    textTransform: "uppercase",
  },

  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },

  button: {
    backgroundColor: colors.espresso,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonAlt: {
    backgroundColor: colors.caramel,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.espresso,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.cream, fontSize: 15, fontWeight: "700" },
  buttonTextGhost: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },

  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  pillActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.mocha },
  pillTextActive: { color: colors.cream },

  divider: { height: 1, backgroundColor: colors.line },
});
