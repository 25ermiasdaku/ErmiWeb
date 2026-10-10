/**
 * Login — exchange a username and password for a session.
 *
 * The same accounts the web uses; a customer signs in with their username
 * (which is derived from their email at registration). On success the session
 * is stored by the auth provider and we land on the account tab.
 */
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/store/auth";
import { colors, shared, spacing } from "@/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username, password);
      router.replace("/(tabs)/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={shared.h1}>Welcome back</Text>
        <Text style={shared.muted}>Sign in to order ahead and keep your points moving.</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={shared.label}>Username</Text>
            <TextInput
              style={shared.input}
              placeholder="Your username (the local part of your email)"
              placeholderTextColor={colors.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
          </View>
          <View style={styles.field}>
            <Text style={shared.label}>Password</Text>
            <TextInput
              style={shared.input}
              placeholder="Your password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!submitting}
              onSubmitEditing={() => void submit()}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[shared.button, submitting && shared.disabled]}
            disabled={submitting}
            onPress={() => void submit()}
          >
            <Text style={shared.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>

        <View style={styles.alt}>
          <Text style={shared.muted}>New to Ermi?</Text>
          <Link href="/register" asChild>
            <Pressable>
              <Text style={styles.link}>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  field: { gap: spacing.sm },
  error: { color: colors.danger, fontSize: 14 },
  alt: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.xl },
  link: { color: colors.caramelDark, fontSize: 14, fontWeight: "700" },
});