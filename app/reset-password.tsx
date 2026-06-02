import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";
import { initialAppRouteFor } from "@/utils/appGuide";

export default function ResetPasswordPage() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canSubmit = Boolean(token) && password.length >= 8 && password === confirmPassword;

  const submit = async () => {
    if (!token) {
      setMessage("This reset link is missing its token. Request a new one from the login page.");
      return;
    }
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setMessage(null);
    try {
      await resetPassword(token, password);
      const userId = useAuthStore.getState().user?.id;
      router.replace(await initialAppRouteFor(userId));
    } catch {
      // The auth store surfaces the message inline.
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <Text variant="displaySmall" style={styles.title}>
            Reset password
          </Text>
          <Text style={styles.subtitle}>Choose a new VCE Forge password and get back to your study plan.</Text>
        </View>

        <AppCard style={styles.form}>
          {!token ? <Text style={styles.error}>This reset link is missing its token.</Text> : null}
          <TextInput
            mode="outlined"
            label="New password"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
          />
          <TextInput
            mode="outlined"
            label="Confirm password"
            value={confirmPassword}
            secureTextEntry
            onChangeText={setConfirmPassword}
          />
          {message || error ? <Text style={error ? styles.error : styles.message}>{error ?? message}</Text> : null}
          <Button mode="contained" icon="lock-reset" loading={loading} disabled={loading || !canSubmit} onPress={submit}>
            Reset password
          </Button>
          <Link href="/(auth)/login" style={styles.link}>
            Back to login
          </Link>
        </AppCard>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: 24
  },
  brand: {
    gap: 10
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23
  },
  form: {
    gap: 14
  },
  message: {
    color: palette.text,
    lineHeight: 20
  },
  error: {
    color: palette.secondary,
    lineHeight: 20
  },
  link: {
    color: palette.primary,
    textAlign: "center",
    fontFamily: "Outfit_700Bold",
    marginTop: 4
  }
});
