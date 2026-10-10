/**
 * Register — create a customer account.
 *
 * Full name, email, an optional phone and a password (min. 8 characters, per
 * the backend's policy). Confirm-password is checked here; the server checks
 * everything else and its per-field messages are shown under the fields.
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
import { ApiError } from "@/api";
import { useAuth } from "@/store/auth";
import { colors, shared, spacing } from "@/theme";

type FieldErrors = Record<string, string | undefined>;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Map the server's snake_case field names to theirs.
  const localErrorFor = (key: string): string | undefined =>
    fieldErrors[key] ?? fieldErrors.full_name ?? fieldErrors.confirm_password;

  const submit = async () => {
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm_password: "The two passwords do not match." });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: "Use at least 8 characters." });
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      router.replace("/(tabs)/account");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors ?? {});
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not create the account. Try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={shared.h1}>Join the loyalty</Text>
        <Text style={shared.muted}>One point per dollar, banked whenever you collect.</Text>

        <View style={styles.form}>
          <Field label="Full name" input={fullName} onChange={setFullName} error={localErrorFor("fullName")} placeholder="Your name" />
          <Field
            label="Email"
            input={email}
            onChange={setEmail}
            error={fieldErrors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field label="Phone (optional)" input={phone} onChange={setPhone} error={fieldErrors.phone} placeholder="+1 555…" keyboardType="phone-pad" />
          <Field label="Password" input={password} onChange={setPassword} error={fieldErrors.password} placeholder="At least 8 characters" secure />
          <Field
            label="Confirm password"
            input={confirm}
            onChange={setConfirm}
            error={fieldErrors.confirm_password}
            placeholder="Same again"
            secure
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[shared.buttonAlt, submitting && shared.disabled]}
            disabled={submitting}
            onPress={() => void submit()}
          >
            <Text style={shared.buttonText}>{submitting ? "Creating…" : "Create account"}</Text>
          </Pressable>
        </View>

        <View style={styles.alt}>
          <Text style={shared.muted}>Already a member?</Text>
          <Link href="/login" asChild>
            <Pressable>
              <Text style={styles.link}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  input,
  onChange,
  error,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  input: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  secure?: boolean;
  keyboardType?: "email-address" | "phone-pad";
  autoCapitalize?: "none";
}) {
  return (
    <View style={styles.field}>
      <Text style={shared.label}>{label}</Text>
      <TextInput
        style={shared.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={input}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={false}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  field: { gap: spacing.sm },
  error: { color: colors.danger, fontSize: 14 },
  fieldError: { color: colors.danger, fontSize: 12 },
  alt: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.xl },
  link: { color: colors.caramelDark, fontSize: 14, fontWeight: "700" },
});