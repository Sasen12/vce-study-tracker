import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { Link, router } from "expo-router";
import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";
import { initialAppRouteFor } from "@/utils/appGuide";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const submit = async () => {
    try {
      await login(email, password);
      const userId = useAuthStore.getState().user?.id;
      router.replace(await initialAppRouteFor(userId));
    } catch {
      // The auth store surfaces the message inline.
    }
  };

  const openReset = () => {
    setResetEmail(email.trim());
    setResetMessage(null);
    setResetOpen(true);
  };

  const sendReset = async () => {
    if (!resetEmail.trim()) {
      setResetMessage("Add your account email first.");
      return;
    }

    setResetSubmitting(true);
    setResetMessage(null);
    try {
      setResetMessage(await requestPasswordReset(resetEmail));
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : "Could not send a reset link. Try again soon.");
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <LinearGradient colors={[palette.primary, palette.secondary]} style={styles.mark} />
          <Text variant="displaySmall" style={styles.title}>
            VCE Forge
          </Text>
          <Text style={styles.subtitle}>Study sessions, SAC dates, AI drills, and the small wins that add up.</Text>
        </View>

        <AppCard style={styles.form}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button mode="contained" icon="login" loading={loading} disabled={loading} onPress={submit}>
            Log in
          </Button>
          <View style={styles.helpLinks}>
            <Pressable accessibilityRole="button" onPress={openReset}>
              <Text style={styles.helpLink}>Forgot password?</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/contact")}>
              <Text style={styles.helpLink}>Forgot email?</Text>
            </Pressable>
          </View>
          <Link href="/(auth)/register" style={styles.link}>
            Create an account
          </Link>
        </AppCard>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={resetOpen} onDismiss={() => setResetOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Reset password</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogBody}>
              Enter your account email and VCE Forge will send a reset link if the account exists.
            </Text>
            <TextInput
              mode="outlined"
              label="Account email"
              value={resetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setResetEmail}
            />
            {resetMessage ? <Text style={styles.resetMessage}>{resetMessage}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetOpen(false)}>Close</Button>
            <Button mode="contained" icon="email-send-outline" loading={resetSubmitting} disabled={resetSubmitting} onPress={sendReset}>
              Send link
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  mark: {
    width: 54,
    height: 8,
    borderRadius: 8
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
  error: {
    color: palette.secondary
  },
  helpLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    flexWrap: "wrap"
  },
  helpLink: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  link: {
    color: palette.primary,
    textAlign: "center",
    fontFamily: "Outfit_700Bold",
    marginTop: 4
  },
  dialog: {
    backgroundColor: palette.surface
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialogContent: {
    gap: 14
  },
  dialogBody: {
    color: palette.muted,
    lineHeight: 21
  },
  resetMessage: {
    color: palette.text,
    lineHeight: 20
  }
});
