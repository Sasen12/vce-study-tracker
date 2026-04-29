import { StyleSheet, View, type ViewStyle } from "react-native";

export function Skeleton({ style }: { style?: ViewStyle }) {
  return <View style={[styles.skeleton, style]} />;
}

export function SkeletonStack() {
  return (
    <View style={styles.stack}>
      <Skeleton style={styles.hero} />
      <Skeleton />
      <Skeleton />
      <Skeleton style={styles.short} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  skeleton: {
    height: 22,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  hero: {
    height: 120
  },
  short: {
    width: "58%"
  }
});
