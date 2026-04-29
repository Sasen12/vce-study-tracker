import Svg, { Circle } from "react-native-svg";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";

type ProgressRingProps = {
  progress: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
  color?: string;
};

export function ProgressRing({
  progress,
  size = 112,
  stroke = 10,
  label,
  sublabel,
  color = palette.primary
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - clamped * circumference}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text variant="titleLarge" style={styles.label}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    position: "absolute",
    alignItems: "center"
  },
  label: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  sublabel: {
    color: palette.muted,
    fontSize: 12
  }
});

