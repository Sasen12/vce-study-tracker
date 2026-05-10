import type { GeneratedQuestion, GeneratedQuestionVisual } from "@/types";

const formatPoint = (point: { x: number; y: number; label: string }) =>
  point.label ? `${point.label}: (${point.x}, ${point.y})` : `(${point.x}, ${point.y})`;

export const visualContextSummary = (visual?: GeneratedQuestionVisual | null) => {
  if (!visual) return "";

  const data =
    visual.type === "bar_chart"
      ? visual.bars.map((bar) => `${bar.label}: ${bar.value}`).join(", ")
      : visual.type === "line_graph" || visual.type === "scatter_plot"
        ? visual.points.map(formatPoint).join(", ")
        : visual.labels.join(", ");

  return [
    `Visual: ${visual.title}`,
    visual.description,
    visual.x_label || visual.y_label ? `Axes: ${visual.x_label || "x"} / ${visual.y_label || "y"}` : "",
    data ? `Data/labels: ${data}` : ""
  ]
    .filter(Boolean)
    .join("\n");
};

export const questionWithVisualContext = (question: GeneratedQuestion) => {
  const visual = visualContextSummary(question.visual);
  return visual ? `${question.question}\n\n${visual}` : question.question;
};
