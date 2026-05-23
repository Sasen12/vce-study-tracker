import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Link, router } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";
import { defaultTabRouteFor, loadDefaultTab } from "@/utils/defaultTab";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const submit = async () => {
    try {
      await login(email, password);
      const userId = useAuthStore.getState().user?.id;
      const defaultTab = await loadDefaultTab(userId);
      router.replace(defaultTabRouteFor(defaultTab));
    } catch {
      // The auth store surfaces the message inline.
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <LinearGradient colors={[palette.primary, palette.secondary]} style={styles.mark} />
          <Text variant="displaySmall" style={styles.title}>
            VCE Pulse
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
          <Link href="/(auth)/register" style={styles.link}>
            Create an account
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
  link: {
    color: palette.primary,
    textAlign: "center",
    fontFamily: "Outfit_700Bold",
    marginTop: 4
  }
});
