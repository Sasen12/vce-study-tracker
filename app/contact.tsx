import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, TextInput } from "react-native-paper";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { palette } from "@/constants/theme";
import { apiFetch } from "@/services/api";

const contactEmail = "techsavvy356@gmail.com";

export default function ContactPage() {
  const { width } = useWindowDimensions();
  const isWide = width >= 940;
  const isCompact = width < 720;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canSubmit = name.trim().length > 1 && email.trim().length > 4 && question.trim().length > 8;

  const sendEmail = async () => {
    if (!canSubmit) {
      setStatus("Add your name, email, and question first.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const response = await apiFetch<{ ok: boolean; delivered: boolean; message: string }>("/contact", {
        method: "POST",
        skipAuth: true,
        body: {
          name,
          email,
          yearLevel,
          school,
          subject,
          question
        }
      });
      setStatus(response.message);
      if (response.ok) {
        setName("");
        setEmail("");
        setYearLevel("");
        setSchool("");
        setSubject("");
        setQuestion("");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send the message. Try again soon.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}>
        <View style={styles.shell}>
          <MarketingHeader active="contact" isCompact={isCompact} />

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroCopy}>
              <View style={styles.badge}>
                <MaterialCommunityIcons name="message-question-outline" color="#38BDF8" size={18} />
                <Text style={styles.badgeText}>Contact</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Ask before you make an account.
              </Text>
              <Text style={styles.heroLead}>
                Send your details, your VCE question, or what you are stuck on. No mail app popup.
              </Text>
              <Text style={styles.heroBody}>
                Good for setup questions, feature ideas, school access, subject support, or anything you want cleared
                up before starting.
              </Text>
            </View>

            <View style={styles.directCard}>
              <Text style={styles.cardLabel}>Direct email</Text>
              <Text style={styles.emailText}>{contactEmail}</Text>
              <Text style={styles.cardBody}>
                The form sends inside VCE Pulse. This address is still here if you want it later.
              </Text>
            </View>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.formSection, isWide && styles.formSectionWide]}>
              <View style={styles.formIntro}>
                <Text style={styles.sectionLabel}>Student details</Text>
                <Text style={styles.sectionTitle}>Send the context in one clean message.</Text>
                <Text style={styles.sectionBody}>
                  The form prepares an email with everything needed to reply properly.
                </Text>
                <View style={styles.contactSignal}>
                  <MaterialCommunityIcons name="email-fast-outline" color={palette.success} size={22} />
                  <Text style={styles.contactSignalText}>No account required. No mail app.</Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <View style={[styles.twoColumns, isCompact && styles.oneColumn]}>
                  <TextInput
                    mode="outlined"
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    autoCapitalize="words"
                  />
                  <TextInput
                    mode="outlined"
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={[styles.twoColumns, isCompact && styles.oneColumn]}>
                  <TextInput
                    mode="outlined"
                    label="Year level"
                    value={yearLevel}
                    onChangeText={setYearLevel}
                    style={styles.input}
                    placeholder="Year 11 or Year 12"
                  />
                  <TextInput
                    mode="outlined"
                    label="School"
                    value={school}
                    onChangeText={setSchool}
                    style={styles.input}
                    autoCapitalize="words"
                  />
                </View>

                <TextInput
                  mode="outlined"
                  label="Subject or area"
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Business Management, Maths, SAC setup, login..."
                />
                <TextInput
                  mode="outlined"
                  label="Question"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={6}
                  style={styles.questionInput}
                />

                {status ? <Text style={styles.status}>{status}</Text> : null}

                <Button mode="contained" icon="email-send-outline" loading={submitting} disabled={!canSubmit || submitting} onPress={sendEmail}>
                  Send email
                </Button>

                <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/register")} style={styles.startLink}>
                  <MaterialCommunityIcons name="account-plus" color="#38BDF8" size={18} />
                  <Text style={styles.startLinkText}>Ready now? Start studying instead.</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06111F"
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 38
  },
  scrollContentCompact: {
    paddingHorizontal: 16
  },
  shell: {
    width: "100%",
    maxWidth: 1160,
    gap: 58
  },
  hero: {
    gap: 24
  },
  heroWide: {
    minHeight: 410,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: 17,
    maxWidth: 660
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(56,189,248,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badgeText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  heroTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 60,
    lineHeight: 66
  },
  heroTitleCompact: {
    fontSize: 40,
    lineHeight: 46
  },
  heroLead: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21,
    lineHeight: 30
  },
  heroBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24
  },
  directCard: {
    flex: 0.72,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(7,20,33,0.88)",
    padding: 20,
    gap: 12
  },
  cardLabel: {
    color: "#38BDF8",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    textTransform: "uppercase"
  },
  emailText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 25,
    lineHeight: 31
  },
  cardBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23
  },
  formSection: {
    gap: 24
  },
  formSectionWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 36
  },
  formIntro: {
    flex: 0.72,
    gap: 11
  },
  sectionLabel: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 34,
    lineHeight: 41
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24
  },
  contactSignal: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.26)",
    backgroundColor: "rgba(74,222,128,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 6
  },
  contactSignalText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  formCard: {
    flex: 1.1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 13
  },
  twoColumns: {
    flexDirection: "row",
    gap: 12
  },
  oneColumn: {
    flexDirection: "column"
  },
  input: {
    flex: 1
  },
  questionInput: {
    minHeight: 132
  },
  status: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  startLink: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6
  },
  startLinkText: {
    color: "#38BDF8",
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  }
});
