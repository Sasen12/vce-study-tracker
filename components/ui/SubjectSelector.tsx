import { ScrollView, StyleSheet, Pressable } from "react-native";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";
import type { UserSubject } from "@/types";

type SubjectSelectorProps = {
  subjects: UserSubject[];
  selectedId?: string | null;
  onSelect: (subject: UserSubject) => void;
};

export function SubjectSelector({ subjects, selectedId, onSelect }: SubjectSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {subjects.map((subject) => {
        const selected = subject.id === selectedId;
        return (
          <Pressable
            key={subject.id}
            onPress={() => onSelect(subject)}
            style={[
              styles.chip,
              selected && { borderColor: subject.color, backgroundColor: `${subject.color}22` }
            ]}
          >
            <Text style={[styles.text, selected && styles.selectedText]} numberOfLines={1}>
              {subject.subjectName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingRight: 20
  },
  chip: {
    minHeight: 40,
    maxWidth: 190,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14
  },
  text: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  selectedText: {
    color: palette.text
  }
});

