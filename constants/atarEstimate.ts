export type ScaledScoreInput = {
  subjectName: string;
  scaled: number;
};

export type AtarEstimate = {
  atar: number;
  aggregate: number;
  englishIncluded: boolean;
};

const rawStudyScorePoints = [20, 25, 30, 35, 40, 45, 50] as const;

const subjectScaling2025: Record<string, number[]> = {
  Accounting: [20, 25, 31, 36, 41, 46, 50],
  "Agricultural and Horticultural Studies": [15, 19, 24, 29, 34, 41, 50],
  Algorithmics: [24, 31, 38, 43, 47, 50, 51],
  "Data Analytics": [16, 21, 26, 32, 38, 44, 50],
  "Software Development": [17, 22, 28, 33, 39, 45, 50],
  "Art Creative Practice": [16, 21, 27, 32, 38, 44, 50],
  "Art Making and Exhibiting": [15, 20, 25, 31, 37, 44, 50],
  Biology: [19, 25, 31, 36, 41, 46, 50],
  "Business Management": [17, 22, 27, 32, 38, 44, 50],
  Chemistry: [22, 28, 34, 39, 44, 47, 50],
  "Classical Studies": [19, 25, 30, 36, 41, 46, 50],
  Dance: [18, 23, 27, 32, 37, 43, 50],
  Drama: [18, 23, 28, 33, 39, 45, 50],
  Economics: [20, 26, 31, 37, 42, 46, 50],
  English: [17, 22, 28, 33, 39, 45, 50],
  "English as an Additional Language": [15, 21, 27, 33, 40, 46, 50],
  "English Language": [22, 27, 33, 38, 43, 47, 50],
  "Environmental Science": [18, 23, 28, 33, 39, 44, 50],
  "Extended Investigation": [22, 27, 33, 38, 42, 47, 50],
  "Food Studies": [14, 19, 23, 29, 35, 42, 50],
  Geography: [18, 23, 28, 34, 39, 45, 50],
  "Health and Human Development": [16, 21, 26, 31, 37, 43, 50],
  "Ancient History": [16, 21, 27, 33, 39, 45, 50],
  "Australian History": [18, 23, 29, 34, 40, 45, 50],
  "History: Revolutions": [18, 23, 29, 34, 40, 45, 50],
  "Industry and Enterprise": [12, 16, 20, 26, 32, 40, 50],
  Arabic: [20, 25, 30, 34, 39, 44, 50],
  "Chinese First Language": [18, 25, 33, 39, 45, 48, 50],
  "Chinese Language, Culture and Society": [22, 28, 33, 38, 43, 47, 50],
  "Chinese Second Language Advanced": [24, 31, 37, 42, 47, 50, 52],
  "Chinese Second Language": [29, 35, 41, 45, 49, 52, 54],
  French: [30, 36, 41, 45, 49, 51, 53],
  German: [27, 34, 39, 44, 48, 51, 53],
  Greek: [24, 30, 35, 40, 44, 47, 50],
  Hebrew: [29, 35, 39, 43, 46, 48, 50],
  Hindi: [23, 30, 36, 42, 46, 50, 52],
  "Indonesian Second Language": [26, 32, 38, 42, 46, 49, 52],
  Italian: [27, 33, 38, 42, 45, 48, 50],
  "Japanese Second Language": [26, 32, 38, 43, 46, 49, 51],
  Karen: [20, 25, 29, 33, 38, 43, 50],
  Khmer: [11, 17, 25, 34, 41, 47, 50],
  "Korean Second Language": [21, 29, 36, 42, 47, 51, 53],
  Latin: [35, 42, 46, 50, 53, 54, 55],
  Macedonian: [21, 27, 32, 37, 42, 47, 51],
  Persian: [16, 20, 24, 29, 34, 40, 50],
  Punjabi: [22, 28, 33, 39, 43, 47, 50],
  Russian: [23, 29, 34, 39, 44, 47, 50],
  Serbian: [22, 26, 31, 36, 40, 45, 50],
  Sinhala: [25, 30, 35, 39, 43, 47, 50],
  Spanish: [26, 31, 35, 40, 44, 47, 50],
  Turkish: [21, 25, 29, 34, 38, 43, 50],
  "Vietnamese First Language": [19, 24, 29, 35, 40, 45, 50],
  "Vietnamese Second Language": [26, 31, 36, 40, 43, 47, 50],
  "Legal Studies": [18, 23, 28, 34, 40, 45, 50],
  Literature: [20, 26, 31, 36, 41, 46, 50],
  "Foundation Mathematics": [12, 16, 20, 26, 32, 40, 50],
  "General Mathematics": [18, 23, 28, 33, 38, 44, 50],
  "Mathematical Methods": [21, 28, 35, 41, 46, 49, 51],
  "Specialist Mathematics": [29, 36, 43, 48, 51, 54, 55],
  Media: [16, 21, 26, 32, 38, 44, 50],
  "Music Composition": [21, 26, 31, 36, 41, 45, 50],
  "Music Contemporary Performance": [17, 22, 27, 33, 38, 44, 50],
  "Music Inquiry": [18, 23, 28, 33, 38, 44, 50],
  "Music Repertoire Performance": [22, 27, 32, 37, 42, 46, 50],
  "Outdoor and Environmental Studies": [15, 20, 24, 30, 36, 42, 50],
  Philosophy: [19, 24, 29, 35, 40, 45, 50],
  "Physical Education": [17, 22, 27, 33, 38, 44, 50],
  Physics: [20, 26, 32, 37, 42, 47, 50],
  "Australian and Global Politics": [21, 27, 32, 37, 42, 46, 50],
  "Global Politics": [21, 27, 32, 37, 42, 46, 50],
  "Product Design and Technologies": [14, 19, 24, 29, 36, 42, 50],
  Psychology: [18, 23, 28, 34, 39, 45, 50],
  "Religion and Society": [18, 23, 28, 34, 39, 45, 50],
  Sociology: [15, 20, 25, 31, 38, 44, 50],
  "Systems Engineering": [17, 21, 26, 32, 37, 43, 50],
  "Texts and Traditions": [17, 22, 27, 32, 37, 43, 50],
  "Theatre Studies": [18, 23, 28, 34, 39, 45, 50],
  "Visual Communication Design": [16, 21, 26, 32, 38, 44, 50]
};

const aggregateToAtar2025: [number, number][] = [
  [65.93, 30],
  [68.77, 32],
  [71.7, 34],
  [74.45, 36],
  [77.45, 38],
  [80.53, 40],
  [83.22, 42],
  [86.08, 44],
  [88.79, 46],
  [91.42, 48],
  [94.06, 50],
  [96.7, 52],
  [99.26, 54],
  [101.94, 56],
  [104.5, 58],
  [107.03, 60],
  [109.74, 62],
  [112.34, 64],
  [114.99, 66],
  [117.73, 68],
  [120.42, 70],
  [123.27, 72],
  [126.21, 74],
  [127.68, 75],
  [129.18, 76],
  [132.22, 78],
  [135.65, 80],
  [139, 82],
  [142.52, 84],
  [144.45, 85],
  [146.36, 86],
  [150.51, 88],
  [155.19, 90],
  [157.79, 91],
  [160.53, 92],
  [163.3, 93],
  [166.49, 94],
  [169.85, 95],
  [173.56, 96],
  [178.1, 97],
  [183.81, 98],
  [192.1, 99],
  [193.21, 99.1],
  [194.14, 99.2],
  [195.44, 99.3],
  [196.97, 99.4],
  [198.2, 99.5],
  [199.91, 99.6],
  [201.93, 99.7],
  [202.98, 99.75],
  [204.33, 99.8],
  [206.01, 99.85],
  [208.08, 99.9],
  [211.42, 99.95]
];

const interpolate = (value: number, points: readonly number[], outputs: readonly number[]) => {
  if (value <= points[0]) {
    return points[0] === 0 ? outputs[0] : (value / points[0]) * outputs[0];
  }

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const nextPoint = points[index];
    if (value <= nextPoint) {
      const ratio = (value - previousPoint) / (nextPoint - previousPoint);
      return outputs[index - 1] + ratio * (outputs[index] - outputs[index - 1]);
    }
  }

  return outputs[outputs.length - 1];
};

export const isEnglishStudy = (subjectName: string) =>
  subjectName === "English" ||
  subjectName === "English as an Additional Language" ||
  subjectName === "English Language" ||
  subjectName === "Literature";

export const scaleStudyScoreForAtar = (subjectName: string, rawScore: number) => {
  const clampedRaw = Math.max(0, Math.min(50, rawScore));
  const scaling = subjectScaling2025[subjectName];
  if (!scaling) return clampedRaw;

  return interpolate(clampedRaw, [0, ...rawStudyScorePoints], [0, ...scaling]);
};

export const aggregateToAtar = (aggregate: number) => {
  if (aggregate <= aggregateToAtar2025[0][0]) return 30;
  const last = aggregateToAtar2025[aggregateToAtar2025.length - 1];
  if (aggregate >= last[0]) return last[1];

  for (let index = 1; index < aggregateToAtar2025.length; index += 1) {
    const previous = aggregateToAtar2025[index - 1];
    const next = aggregateToAtar2025[index];
    if (aggregate <= next[0]) {
      const ratio = (aggregate - previous[0]) / (next[0] - previous[0]);
      const interpolated = previous[1] + ratio * (next[1] - previous[1]);
      return Math.round(interpolated * 20) / 20;
    }
  }

  return 30;
};

export const estimateAtarFromScaledScores = (scores: ScaledScoreInput[]): AtarEstimate => {
  const ranked = scores
    .map((score, index) => ({ ...score, index, scaled: Math.max(0, score.scaled) }))
    .filter((score) => score.scaled > 0)
    .sort((a, b) => b.scaled - a.scaled);

  const english = ranked.filter((score) => isEnglishStudy(score.subjectName)).sort((a, b) => b.scaled - a.scaled)[0];
  const primaryIndexes = new Set<number>();
  const primaryScores: number[] = [];

  if (english) {
    primaryIndexes.add(english.index);
    primaryScores.push(english.scaled);
  }

  for (const score of ranked) {
    if (primaryScores.length >= 4) break;
    if (primaryIndexes.has(score.index)) continue;
    primaryIndexes.add(score.index);
    primaryScores.push(score.scaled);
  }

  const incrementScores = ranked
    .filter((score) => !primaryIndexes.has(score.index))
    .slice(0, 2)
    .map((score) => score.scaled * 0.1);

  const aggregate = primaryScores.reduce((sum, score) => sum + score, 0) + incrementScores.reduce((sum, score) => sum + score, 0);

  return {
    aggregate,
    atar: aggregateToAtar(aggregate),
    englishIncluded: Boolean(english)
  };
};
