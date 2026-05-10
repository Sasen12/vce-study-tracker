import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import {
  evaluateScientificExpression,
  formatCalculatorResult,
  type CalculatorAngleMode
} from "@/utils/scientificCalculator";

type ScientificCalculatorProps = {
  subjectName?: string | null;
};

type CalcKey = {
  label: string;
  insert?: string;
  action?: "equals" | "clear" | "delete";
  emphasis?: boolean;
};

const keyRows: CalcKey[][] = [
  [
    { label: "sin", insert: "sin(" },
    { label: "cos", insert: "cos(" },
    { label: "tan", insert: "tan(" },
    { label: "log", insert: "log(" }
  ],
  [
    { label: "ln", insert: "ln(" },
    { label: "sqrt", insert: "sqrt(" },
    { label: "^", insert: "^" },
    { label: "pi", insert: "pi" }
  ],
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "/", insert: "/" }
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "*", insert: "*" }
  ],
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "-", insert: "-" }
  ],
  [
    { label: "0", insert: "0" },
    { label: ".", insert: "." },
    { label: "%", insert: "%" },
    { label: "+", insert: "+" }
  ],
  [
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
    { label: "ans", insert: "ans" },
    { label: "=", action: "equals", emphasis: true }
  ]
];

export function ScientificCalculator({ subjectName }: ScientificCalculatorProps) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answerMemory, setAnswerMemory] = useState(0);
  const [angleMode, setAngleMode] = useState<CalculatorAngleMode>("deg");

  const append = (value: string) => {
    setExpression((current) => `${current}${value}`);
    setError(null);
  };

  const calculate = () => {
    try {
      const value = evaluateScientificExpression(expression, { angleMode, ans: answerMemory });
      const formatted = formatCalculatorResult(value);
      setResult(formatted);
      setAnswerMemory(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate that");
    }
  };

  const pressKey = (key: CalcKey) => {
    if (key.action === "equals") {
      calculate();
      return;
    }
    if (key.action === "clear") {
      setExpression("");
      setResult("");
      setError(null);
      return;
    }
    if (key.action === "delete") {
      setExpression((current) => current.slice(0, -1));
      setError(null);
      return;
    }
    if (key.insert) append(key.insert);
  };

  return (
    <AppCard style={styles.calculatorCard}>
      <View style={styles.calcHeader}>
        <View>
          <Text style={styles.calcKicker}>{subjectName ?? "Subject"} tool</Text>
          <Text style={styles.calcTitle}>Scientific calculator</Text>
        </View>
        <SegmentedButtons
          value={angleMode}
          onValueChange={(value) => setAngleMode(value as CalculatorAngleMode)}
          buttons={[
            { value: "deg", label: "Deg" },
            { value: "rad", label: "Rad" }
          ]}
          style={styles.angleToggle}
        />
      </View>
      <TextInput
        mode="outlined"
        label="Calculation"
        value={expression}
        onChangeText={(value) => {
          setExpression(value);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.calcInput}
      />
      <View style={styles.resultPanel}>
        <Text style={styles.resultLabel}>Result</Text>
        <Text style={styles.resultValue}>{error ? error : result || "0"}</Text>
      </View>
      <View style={styles.calcActions}>
        <Button mode="outlined" compact icon="backspace-outline" onPress={() => pressKey({ label: "DEL", action: "delete" })}>
          DEL
        </Button>
        <Button mode="outlined" compact icon="close-circle-outline" onPress={() => pressKey({ label: "AC", action: "clear" })}>
          AC
        </Button>
        <Button mode="contained" compact icon="equal" disabled={!expression.trim()} onPress={calculate}>
          Equals
        </Button>
      </View>
      <View style={styles.keypad}>
        {keyRows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keyRow}>
            {row.map((key) => (
              <Pressable
                key={`${rowIndex}-${key.label}`}
                style={[styles.calcKey, key.emphasis && styles.calcKeyEmphasis]}
                onPress={() => pressKey(key)}
              >
                <Text style={[styles.calcKeyText, key.emphasis && styles.calcKeyTextEmphasis]}>{key.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  calculatorCard: {
    gap: 12
  },
  calcHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12
  },
  calcKicker: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  calcTitle: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  angleToggle: {
    minWidth: 150
  },
  calcInput: {
    backgroundColor: palette.surface
  },
  resultPanel: {
    minHeight: 68,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}33`,
    backgroundColor: "rgba(74,222,128,0.1)",
    padding: 12
  },
  resultLabel: {
    color: palette.success,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  resultValue: {
    color: palette.text,
    fontSize: 24,
    fontFamily: "Outfit_700Bold"
  },
  calcActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  keypad: {
    gap: 8
  },
  keyRow: {
    flexDirection: "row",
    gap: 8
  },
  calcKey: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 4
  },
  calcKeyEmphasis: {
    borderColor: `${palette.info}77`,
    backgroundColor: `${palette.info}22`
  },
  calcKeyText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  calcKeyTextEmphasis: {
    color: palette.info
  }
});
