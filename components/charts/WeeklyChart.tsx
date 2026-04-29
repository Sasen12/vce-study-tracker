import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { BarChart } from "react-native-gifted-charts";
import { palette } from "@/constants/theme";

type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export function WeeklyChart({ data }: { data: ChartDatum[] }) {
  const chartData = data.map((item) => ({
    value: Math.round(item.value * 10) / 10,
    label: item.label.slice(0, 3),
    frontColor: item.color ?? palette.primary
  }));

  return (
    <View style={styles.wrap}>
      {chartData.length ? (
        <BarChart
          data={chartData}
          height={150}
          barWidth={24}
          spacing={18}
          roundedTop
          roundedBottom
          hideRules
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisTextStyle={styles.axis}
          xAxisLabelTextStyle={styles.axis}
          noOfSections={4}
        />
      ) : (
        <Text style={styles.empty}>No study data yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 170,
    justifyContent: "center"
  },
  axis: {
    color: palette.muted,
    fontSize: 10
  },
  empty: {
    color: palette.muted,
    textAlign: "center"
  }
});

