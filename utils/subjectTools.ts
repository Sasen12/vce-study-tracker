export type SubjectVisualKind = "graph" | "chart" | "diagram" | "image";

export type SubjectToolProfile = {
  calculator: boolean;
  visual: boolean;
  graph: boolean;
  visualKinds: SubjectVisualKind[];
  visualLabel: string;
  calculatorLabel: string;
};

const EMPTY_PROFILE: SubjectToolProfile = {
  calculator: false,
  visual: false,
  graph: false,
  visualKinds: [],
  visualLabel: "Visual",
  calculatorLabel: "Calculator"
};

const normaliseSubject = (subjectName?: string | null) => subjectName?.trim().toLowerCase() ?? "";

const matches = (subject: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(subject));

const mathsPatterns = [
  /foundation mathematics/,
  /general mathematics/,
  /mathematical methods/,
  /specialist mathematics/,
  /\bmethods\b/,
  /\bspesh\b/,
  /\bspecialist\b/
];

const graphSubjectPatterns = [
  ...mathsPatterns,
  /algorithmics/,
  /data analytics/,
  /physics/,
  /chemistry/,
  /biology/,
  /environmental science/,
  /psychology/,
  /geography/,
  /economics/,
  /accounting/,
  /vce vm numeracy/
];

const diagramSubjectPatterns = [
  ...graphSubjectPatterns,
  /applied computing/,
  /software development/,
  /systems engineering/,
  /product design/,
  /visual communication/,
  /art /,
  /^art/,
  /media/,
  /health and human development/,
  /physical education/,
  /outdoor and environmental/
];

const calculatorSubjectPatterns = [
  ...mathsPatterns,
  /algorithmics/,
  /physics/,
  /chemistry/,
  /environmental science/,
  /psychology/,
  /accounting/,
  /economics/,
  /data analytics/,
  /systems engineering/,
  /vce vm numeracy/,
  /vce vet engineering/,
  /vce vet electrical/,
  /vce vet laboratory/,
  /vce vet plumbing/,
  /vce vet renewable/,
  /vce vet civil/
];

export const subjectToolProfile = (subjectName?: string | null): SubjectToolProfile => {
  const subject = normaliseSubject(subjectName);
  if (!subject) return EMPTY_PROFILE;

  const graph = matches(subject, graphSubjectPatterns);
  const diagram = matches(subject, diagramSubjectPatterns);
  const calculator = matches(subject, calculatorSubjectPatterns);
  const maths = matches(subject, mathsPatterns);
  const visualKinds = Array.from(
    new Set<SubjectVisualKind>([
      ...(graph ? (["graph", "chart"] as SubjectVisualKind[]) : []),
      ...(diagram ? (["diagram"] as SubjectVisualKind[]) : []),
      ...(matches(subject, [/visual communication/, /^art|art /, /media/, /product design/]) ? (["image"] as SubjectVisualKind[]) : [])
    ])
  );

  return {
    calculator,
    visual: visualKinds.length > 0,
    graph,
    visualKinds,
    visualLabel: maths ? "Graph/diagram" : graph ? "Chart/diagram" : "Diagram/image",
    calculatorLabel: maths ? "Scientific/CAS helper" : "Scientific calculator"
  };
};

export const visualSubjectHint = (profile: SubjectToolProfile) => {
  if (profile.graph) return "graphs, charts and diagrams";
  if (profile.visualKinds.includes("image")) return "diagrams and image prompts";
  if (profile.visual) return "diagrams";
  return "text-only";
};
