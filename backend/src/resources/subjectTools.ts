export type SubjectVisualKind = "graph" | "chart" | "diagram" | "image";

export type SubjectToolProfile = {
  calculator: boolean;
  visual: boolean;
  graph: boolean;
  visualKinds: SubjectVisualKind[];
  visualLabel: string;
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
  const graph = matches(subject, graphSubjectPatterns);
  const diagram = matches(subject, diagramSubjectPatterns);
  const maths = matches(subject, mathsPatterns);
  const visualKinds = Array.from(
    new Set<SubjectVisualKind>([
      ...(graph ? (["graph", "chart"] as SubjectVisualKind[]) : []),
      ...(diagram ? (["diagram"] as SubjectVisualKind[]) : []),
      ...(matches(subject, [/visual communication/, /^art|art /, /media/, /product design/]) ? (["image"] as SubjectVisualKind[]) : [])
    ])
  );

  return {
    calculator: matches(subject, calculatorSubjectPatterns),
    visual: visualKinds.length > 0,
    graph,
    visualKinds,
    visualLabel: maths ? "maths graph/diagram" : graph ? "chart/diagram" : "diagram/image"
  };
};

export const visualTopicLooksRelevant = (topic: string) =>
  /\b(graph|plot|chart|diagram|table|data|map|gradient|function|relation|curve|axis|axes|trend|scatter|box plot|histogram|network|circuit|field|motion|statistics|probability|visuali[sz]ation|infographic|flowchart)\b/i.test(
    topic
  );
