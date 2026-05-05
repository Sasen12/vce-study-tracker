import { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";

type FormattedStudyTextProps = {
  value: string;
  compact?: boolean;
};

type FormattedBlock = {
  id: string;
  kind: "heading" | "paragraph" | "bullet" | "math" | "spacer";
  text: string;
};

const labelHeadings = new Set(["question", "answer", "key points", "sources", "follow-up questions"]);

const replaceSimpleCommand = (value: string, command: string, replacement: string) =>
  value.replace(new RegExp(`\\\\${command}\\b`, "g"), replacement);

const unwrapCommand = (value: string, command: string) => {
  let output = value;
  for (let index = 0; index < 4; index += 1) {
    output = output.replace(new RegExp(`\\\\${command}\\{([^{}]*)\\}`, "g"), "$1");
  }
  return output;
};

const simplifyLatex = (value: string) => {
  let output = value.trim();

  for (let index = 0; index < 4; index += 1) {
    output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  }

  output = unwrapCommand(output, "boxed");
  output = unwrapCommand(output, "text");
  output = output.replace(/\\left|\\right/g, "");
  output = replaceSimpleCommand(output, "times", " x ");
  output = replaceSimpleCommand(output, "cdot", " * ");
  output = replaceSimpleCommand(output, "approx", " ~= ");
  output = replaceSimpleCommand(output, "leq", " <= ");
  output = replaceSimpleCommand(output, "geq", " >= ");
  output = replaceSimpleCommand(output, "neq", " != ");
  output = replaceSimpleCommand(output, "div", " / ");
  output = replaceSimpleCommand(output, "pi", "pi");
  output = output.replace(/\\[$%#&]/g, (match) => match.slice(1));
  output = output.replace(/\\[,;:!]/g, " ");
  output = output.replace(/\\[()[\]]/g, "");
  output = output.replace(/\\[a-zA-Z]+/g, (match) => match.slice(1));
  output = output.replace(/[{}]/g, "");
  output = output.replace(/[ \t]+/g, " ");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
};

const cleanInlineText = (value: string) =>
  value
    .replace(/\\\((.*?)\\\)/g, (_, math: string) => simplifyLatex(math))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\[$%#&]/g, (match) => match.slice(1))
    .trim();

const isMathStart = (value: string) => value.startsWith("\\[") || value.startsWith("$$");

const readMathBlock = (lines: string[], startIndex: number) => {
  const first = lines[startIndex].trim();
  const dollarDelimited = first.startsWith("$$");
  const startToken = dollarDelimited ? "$$" : "\\[";
  const endToken = dollarDelimited ? "$$" : "\\]";
  const content: string[] = [];
  let index = startIndex;
  let current = first.slice(startToken.length);

  while (index < lines.length) {
    const endIndex = current.indexOf(endToken);
    if (endIndex >= 0) {
      content.push(current.slice(0, endIndex));
      return { text: simplifyLatex(content.join("\n")), nextIndex: index + 1 };
    }

    content.push(current);
    index += 1;
    current = lines[index]?.trim() ?? "";
  }

  return { text: simplifyLatex(content.join("\n")), nextIndex: lines.length };
};

const isSpecialLine = (value: string) => {
  const trimmed = value.trim();
  return !trimmed || isMathStart(trimmed) || /^#{1,6}\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed);
};

const parseFormattedBlocks = (value: string): FormattedBlock[] => {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: FormattedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const id = `${blocks.length}-${index}`;

    if (!trimmed) {
      if (blocks.at(-1)?.kind !== "spacer") {
        blocks.push({ id, kind: "spacer", text: "" });
      }
      index += 1;
      continue;
    }

    if (isMathStart(trimmed)) {
      const math = readMathBlock(lines, index);
      blocks.push({ id, kind: "math", text: math.text });
      index = math.nextIndex;
      continue;
    }

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ id, kind: "heading", text: cleanInlineText(heading[1]) });
      index += 1;
      continue;
    }

    if (labelHeadings.has(trimmed.toLowerCase())) {
      blocks.push({ id, kind: "heading", text: trimmed });
      index += 1;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push({ id, kind: "bullet", text: cleanInlineText(bullet[1]) });
      index += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length && !isSpecialLine(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ id, kind: "paragraph", text: cleanInlineText(paragraphLines.join(" ")) });
  }

  return blocks.filter((block, blockIndex, allBlocks) => block.kind !== "spacer" || (blockIndex > 0 && blockIndex < allBlocks.length - 1));
};

export function FormattedStudyText({ value, compact = false }: FormattedStudyTextProps) {
  const blocks = useMemo(() => parseFormattedBlocks(value), [value]);

  return (
    <View style={[styles.stack, compact && styles.compactStack]}>
      {blocks.map((block) => {
        if (block.kind === "spacer") {
          return <View key={block.id} style={compact ? styles.compactSpacer : styles.spacer} />;
        }

        if (block.kind === "heading") {
          return (
            <Text key={block.id} style={[styles.heading, compact && styles.compactHeading]}>
              {block.text}
            </Text>
          );
        }

        if (block.kind === "math") {
          return (
            <View key={block.id} style={styles.mathBlock}>
              <Text selectable style={styles.mathText}>
                {block.text}
              </Text>
            </View>
          );
        }

        if (block.kind === "bullet") {
          return (
            <View key={block.id} style={styles.bulletRow}>
              <Text style={styles.bulletMarker}>-</Text>
              <Text style={[styles.paragraph, styles.bulletText]}>{block.text}</Text>
            </View>
          );
        }

        return (
          <Text key={block.id} style={styles.paragraph}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

const monoFont = Platform.select({
  web: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  default: "monospace"
});

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  compactStack: {
    gap: 6
  },
  paragraph: {
    color: palette.text,
    lineHeight: 22
  },
  heading: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 2
  },
  compactHeading: {
    fontSize: 14,
    lineHeight: 20
  },
  mathBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}55`,
    backgroundColor: `${palette.info}12`,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  mathText: {
    color: palette.text,
    fontFamily: monoFont,
    lineHeight: 22
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  bulletMarker: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    lineHeight: 22
  },
  bulletText: {
    flex: 1
  },
  spacer: {
    height: 2
  },
  compactSpacer: {
    height: 1
  }
});
