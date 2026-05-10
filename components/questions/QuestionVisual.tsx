import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";
import type { GeneratedQuestionVisual } from "@/types";

type QuestionVisualProps = {
  visual?: GeneratedQuestionVisual | null;
};

const chartWidth = 320;
const chartHeight = 190;
const padLeft = 42;
const padRight = 18;
const padTop = 20;
const padBottom = 36;
const plotWidth = chartWidth - padLeft - padRight;
const plotHeight = chartHeight - padTop - padBottom;

const clampFinite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const rangeFor = (values: number[]) => {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return { min: 0, max: 1 };
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (min === max) {
    const spread = Math.max(1, Math.abs(min) * 0.2);
    return { min: min - spread, max: max + spread };
  }
  const spread = (max - min) * 0.08;
  return { min: min - spread, max: max + spread };
};

const chartPoint = (x: number, y: number, xRange: { min: number; max: number }, yRange: { min: number; max: number }) => {
  const px = padLeft + ((clampFinite(x) - xRange.min) / (xRange.max - xRange.min)) * plotWidth;
  const py = padTop + plotHeight - ((clampFinite(y) - yRange.min) / (yRange.max - yRange.min)) * plotHeight;
  return { x: px, y: py };
};

function AxisFrame({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  return (
    <>
      <Line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotHeight} stroke="rgba(240,240,255,0.72)" strokeWidth={1.4} />
      <Line x1={padLeft} y1={padTop + plotHeight} x2={padLeft + plotWidth} y2={padTop + plotHeight} stroke="rgba(240,240,255,0.72)" strokeWidth={1.4} />
      {[0.25, 0.5, 0.75].map((tick) => (
        <Line
          key={tick}
          x1={padLeft}
          y1={padTop + plotHeight * tick}
          x2={padLeft + plotWidth}
          y2={padTop + plotHeight * tick}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
        />
      ))}
      <SvgText x={padLeft + plotWidth / 2} y={chartHeight - 7} fill={palette.muted} fontSize={10} textAnchor="middle">
        {xLabel || "x"}
      </SvgText>
      <SvgText x={padLeft} y={12} fill={palette.muted} fontSize={10} textAnchor="start">
        {yLabel || "y"}
      </SvgText>
    </>
  );
}

function PointChart({ visual }: { visual: GeneratedQuestionVisual }) {
  const points = visual.points.slice(0, 10);
  const xRange = rangeFor(points.map((point) => point.x));
  const yRange = rangeFor(points.map((point) => point.y));
  const rendered = points.map((point) => ({ source: point, ...chartPoint(point.x, point.y, xRange, yRange) }));
  const linePoints = rendered.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      <AxisFrame xLabel={visual.x_label} yLabel={visual.y_label} />
      {visual.type === "line_graph" && rendered.length > 1 ? (
        <Polyline points={linePoints} fill="none" stroke={palette.info} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {rendered.map((point, index) => (
        <Circle key={`${point.source.x}-${point.source.y}-${index}`} cx={point.x} cy={point.y} r={4.4} fill={palette.success} />
      ))}
      {rendered
        .filter((point) => point.source.label)
        .slice(0, 5)
        .map((point, index) => (
          <SvgText key={`${point.source.label}-${index}`} x={point.x + 7} y={Math.max(12, point.y - 7)} fill={palette.text} fontSize={10}>
            {point.source.label}
          </SvgText>
        ))}
    </Svg>
  );
}

function BarChart({ visual }: { visual: GeneratedQuestionVisual }) {
  const bars = visual.bars.slice(0, 7);
  const maxValue = Math.max(1, ...bars.map((bar) => clampFinite(bar.value)));
  const barGap = 8;
  const barWidth = Math.max(18, (plotWidth - barGap * Math.max(0, bars.length - 1)) / Math.max(1, bars.length));

  return (
    <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      <AxisFrame xLabel={visual.x_label || "category"} yLabel={visual.y_label || "value"} />
      {bars.map((bar, index) => {
        const height = (clampFinite(bar.value) / maxValue) * plotHeight;
        const x = padLeft + index * (barWidth + barGap);
        const y = padTop + plotHeight - height;
        return (
          <G key={`${bar.label}-${index}`}>
            <Rect x={x} y={y} width={barWidth} height={height} rx={3} fill={palette.info} opacity={0.9} />
            <SvgText x={x + barWidth / 2} y={chartHeight - 22} fill={palette.muted} fontSize={9} textAnchor="middle">
              {bar.label.slice(0, 10)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function DiagramVisual({ visual }: { visual: GeneratedQuestionVisual }) {
  const labels = visual.labels.length ? visual.labels.slice(0, 5) : [visual.title];
  return (
    <View style={styles.diagramRow}>
      {labels.map((label, index) => (
        <View key={`${label}-${index}`} style={styles.diagramNode}>
          <Text style={styles.diagramNodeText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function QuestionVisual({ visual }: QuestionVisualProps) {
  if (!visual) return null;

  const chart =
    visual.type === "line_graph" || visual.type === "scatter_plot" ? (
      <PointChart visual={visual} />
    ) : visual.type === "bar_chart" ? (
      <BarChart visual={visual} />
    ) : (
      <DiagramVisual visual={visual} />
    );

  return (
    <View style={styles.visualBox}>
      <View style={styles.visualHeader}>
        <Text style={styles.visualTitle}>{visual.title}</Text>
        <Text style={styles.visualType}>{visual.type.replace("_", " ")}</Text>
      </View>
      {chart}
      {visual.description ? <Text style={styles.visualDescription}>{visual.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  visualBox: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.28)",
    backgroundColor: "rgba(96,165,250,0.08)",
    padding: 12
  },
  visualHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  visualTitle: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  visualType: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: `${palette.info}24`,
    color: palette.info,
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase"
  },
  visualDescription: {
    color: palette.muted,
    lineHeight: 18
  },
  diagramRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  diagramNode: {
    minHeight: 46,
    minWidth: 118,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.28)",
    backgroundColor: "rgba(74,222,128,0.1)",
    padding: 10
  },
  diagramNodeText: {
    color: palette.text,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
