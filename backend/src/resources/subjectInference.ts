import {
  normaliseSubjectName,
  subjectMetaFor,
  vceSubjectCatalogue,
  type VceSubjectCategory
} from "./vceSubjectCatalogue.js";

type WeightedPattern = {
  pattern: RegExp;
  weight: number;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "for",
  "in",
  "of",
  "the",
  "to",
  "unit",
  "units",
  "vce",
  "vet",
  "vm",
  "study",
  "studies"
]);

const aliasOverrides: Record<string, string[]> = {
  "English as an Additional Language": ["eal", "english additional language"],
  "Foundation Mathematics": ["foundation maths"],
  "General Mathematics": ["general maths", "further maths"],
  "Mathematical Methods": ["maths methods", "math methods", "methods"],
  "Specialist Mathematics": ["specialist maths", "spesh"],
  Algorithmics: ["algorithms"],
  "Agricultural and Horticultural Studies": ["agriculture", "horticulture", "ag hort"],
  "Environmental Science": ["enviro science"],
  "Data Analytics": ["data analysis", "analytics", "infographic", "infographics"],
  "Software Development": ["software dev", "soft dev", "programming"],
  "Product Design and Technologies": ["product design", "pdt"],
  "Business Management": ["busman", "business"],
  "History: Revolutions": ["revolutions", "revs"],
  "Legal Studies": ["legal"],
  "Health and Human Development": ["hhd"],
  "Outdoor and Environmental Studies": ["outdoor ed", "oes"],
  "Physical Education": ["physical ed"],
  "Visual Communication Design": ["viscom", "visual communication", "vcd"],
  "VCE VM Personal Development Skills": ["pds", "personal development"],
  "VCE VM Work Related Skills": ["wrs", "work related"],
  "VCE VET Hospitality: Cookery": ["cookery", "kitchen operations"],
  "VCE VET Information and Communications Technology": ["vet ict", "ict"]
};

const subjectSignals: Record<string, WeightedPattern[]> = {
  English: [
    { pattern: /\bargument analysis|analysing argument|analyzing argument|language analysis|text response|comparative|contention|framework of ideas\b/i, weight: 7 },
    { pattern: /\boral presentation|persuasive language|country for analysing argument|country for analyzing argument\b/i, weight: 6 },
    { pattern: /\bessay|thesis|topic sentence|authorial choice|written explanation\b/i, weight: 4 }
  ],
  "English Language": [
    { pattern: /\bsubsystem|metalanguage|discourse|phonology|morphology|syntax|lexicology|semantics\b/i, weight: 7 },
    { pattern: /\banalytical commentary|spoken discourse|written discourse\b/i, weight: 5 }
  ],
  Literature: [{ pattern: /\bliterary perspective|close analysis|passage analysis|views and values|interpretation\b/i, weight: 6 }],
  "General Mathematics": [
    { pattern: /\bmatrix|matrices|recursion|recurrence|networks?|critical path|maximum flow\b/i, weight: 7 },
    { pattern: /\bfinancial modelling|financial modeling\b/i, weight: 14 },
    { pattern: /\bcompound interest|simple interest|depreciation|loan repayments?|annuit(?:y|ies)|perpetuit(?:y|ies)\b/i, weight: 9 },
    { pattern: /\breducing balance|flat rate|monthly compounding|quarterly compounding|effective interest|nominal interest\b/i, weight: 7 }
  ],
  "Mathematical Methods": [
    { pattern: /\bcalculus|derivative|integral|function|probability density|normal distribution|stationary point\b/i, weight: 6 }
  ],
  "Specialist Mathematics": [
    { pattern: /\bcomplex numbers?|vectors?|mechanics|differential equation|kinematics|argand\b/i, weight: 6 }
  ],
  Algorithmics: [{ pattern: /\balgorithm|complexity|data structure|graph theory|pseudocode|computational thinking\b/i, weight: 7 }],
  Biology: [
    { pattern: /\bcell|cells|dna|rna|enzyme|photosynthesis|respiration|homeostasis|immune|evolution\b/i, weight: 5 },
    { pattern: /\bgene|genetic|allele|mutation|protein synthesis|pathogen|antibody|crispr\b/i, weight: 5 }
  ],
  Chemistry: [
    { pattern: /\bmole|molar|stoichiometry|titration|oxidation|reduction|enthalpy|hydrocarbon\b/i, weight: 6 },
    { pattern: /\bacid|base|covalent|ionic|equilibrium|reaction rate|organic chemistry|spectroscopy\b/i, weight: 5 }
  ],
  "Environmental Science": [{ pattern: /\bbiodiversity|ecosystem|pollution|climate|sustainability|environmental impact\b/i, weight: 6 }],
  Physics: [
    { pattern: /\bforce|velocity|acceleration|momentum|energy|power|circuit|voltage|current\b/i, weight: 5 },
    { pattern: /\bnewton|magnetic field|electric field|wave|frequency|gravity|projectile\b/i, weight: 5 }
  ],
  Psychology: [
    { pattern: /\bbrain|neuron|memory|learning|conditioning|sleep|stress|mental health\b/i, weight: 5 },
    { pattern: /\bamygdala|hippocampus|classical conditioning|operant conditioning|consciousness\b/i, weight: 5 }
  ],
  "Data Analytics": [
    { pattern: /\bdata analytics|data analysis|applied computing\b/i, weight: 8 },
    { pattern: /\binfographic|data visuali[sz]ation|dashboard|chart|graph|axis|axes|visual hierarchy\b/i, weight: 6 },
    { pattern: /\bevaluation criteria|efficiency|effectiveness|target audience|research question\b/i, weight: 5 },
    { pattern: /\bBOM\b|Climate Data Online|Melbourne Airport Station|cleaned BOM|temperature data\b/i, weight: 7 },
    { pattern: /\bdata acquisition|data cleansing|data cleaning|data dictionary|metadata|data integrity\b/i, weight: 5 }
  ],
  "Software Development": [
    { pattern: /\balgorithm|pseudocode|program|code|function|trace table|test case|validation\b/i, weight: 6 },
    { pattern: /\brequirements|software design|data dictionary|user interface|cybersecurity\b/i, weight: 5 }
  ],
  "Product Design and Technologies": [{ pattern: /\bdesign brief|product design|materials?|prototype|production plan\b/i, weight: 6 }],
  "Food Studies": [{ pattern: /\bnutrition|food system|sensory analysis|food security|diet|recipe\b/i, weight: 6 }],
  "Systems Engineering": [{ pattern: /\bmechanical system|electrotechnology|control system|systems diagram|fault finding\b/i, weight: 6 }],
  Accounting: [
    { pattern: /\bbalance sheet|income statement|ledger|journal entry|debit|credit|accounts receivable|accounts payable\b/i, weight: 7 },
    { pattern: /\bassets|liabilities|equity|cash flow|gross profit|net profit|inventory turnover\b/i, weight: 5 }
  ],
  Economics: [
    { pattern: /\bsupply and demand|aggregate demand|aggregate supply|inflation|gdp|monetary policy|fiscal policy\b/i, weight: 7 },
    { pattern: /\bexchange rate|unemployment|scarcity|opportunity cost|market failure|elasticity\b/i, weight: 5 }
  ],
  "Business Management": [
    { pattern: /\bbusiness management|management style|management skill|stakeholder|corporate culture\b/i, weight: 7 },
    { pattern: /\boperations management|human resources|employee|motivation|kpi|key performance indicator\b/i, weight: 6 },
    { pattern: /\bswot|porter|change management|leadership|business objective|strategy\b/i, weight: 5 }
  ],
  Geography: [
    { pattern: /\bgeography|fieldwork|spatial|map|mapping|land use|urban|liveability|sustainability\b/i, weight: 6 },
    { pattern: /\bfed square|federation square|melbourne cbd|place|scale|distribution|human environment\b/i, weight: 6 }
  ],
  "Legal Studies": [
    { pattern: /\bconstitution|parliament|court|justice|law reform|precedent|statutory interpretation\b/i, weight: 6 },
    { pattern: /\bcivil|criminal|rights|remedy|sanction|jury|high court|principles of justice\b/i, weight: 5 }
  ],
  "History: Revolutions": [{ pattern: /\brevolution|revolutions|french revolution|russian revolution|china revolution|crisis\b/i, weight: 7 }],
  Philosophy: [
    { pattern: /\bphilosophy|logic|objection|premise|conclusion|metaphysics|epistemology\b/i, weight: 6 },
    { pattern: /\bphilosophical argument|ethical theory|moral philosophy\b/i, weight: 6 }
  ],
  Sociology: [{ pattern: /\bsociology|culture|identity|deviance|social theory|community|social research\b/i, weight: 6 }],
  "Health and Human Development": [{ pattern: /\bhealth status|wellbeing|human development|health promotion|sustainable development\b/i, weight: 6 }],
  "Physical Education": [{ pattern: /\benergy systems?|training principles?|acute adaptation|chronic adaptation|skill acquisition\b/i, weight: 6 }],
  Drama: [{ pattern: /\bdrama|dramatic elements|performance style|expressive skills|stagecraft|devised\b/i, weight: 6 }],
  Media: [{ pattern: /\bmedia|narrative|representation|audience|media code|convention|production design\b/i, weight: 5 }],
  Music: [{ pattern: /\bmusic|repertoire|listening analysis|composition|performance|expressive control\b/i, weight: 5 }],
  "Visual Communication Design": [{ pattern: /\bvisual communication|typography|layout|design field|visual language|design brief\b/i, weight: 7 }]
};

const categorySignals: Record<VceSubjectCategory, WeightedPattern[]> = {
  English: [{ pattern: /\bessay|paragraph|contention|language|text response\b/i, weight: 1 }],
  Mathematics: [{ pattern: /\bcalculate|solve|equation|formula|graph|probability|statistics\b/i, weight: 1 }],
  Sciences: [{ pattern: /\bexperiment|hypothesis|variable|data table|practical report|scientific\b/i, weight: 1 }],
  Technology: [{ pattern: /\bdesign|test|criteria|evaluation|prototype|data|software|security\b/i, weight: 1 }],
  Humanities: [{ pattern: /\bcase study|source analysis|evidence|evaluate|compare|cause|consequence\b/i, weight: 1 }],
  "Health and PE": [{ pattern: /\bhealth|body|training|performance|population|wellbeing|risk\b/i, weight: 1 }],
  "The Arts": [{ pattern: /\bartist|performance|production|folio|creative|design|audience\b/i, weight: 1 }],
  Languages: [{ pattern: /\boral|listening|reading|writing|grammar|vocabulary|translation\b/i, weight: 1 }],
  "VCE VM": [{ pattern: /\bportfolio|applied|workplace|reflection|project|evidence\b/i, weight: 1 }],
  "VCE VET": [{ pattern: /\bcompetency|workplace|safety|procedure|evidence log|practical task\b/i, weight: 1 }]
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasPhrase = (question: string, phrase: string) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`, "i").test(question);

const importantWords = (subject: string) =>
  normaliseSubjectName(subject)
    .replace(/[:/,-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

const generatedAliasesFor = (subjectName: string) => {
  const withoutPrefixes = subjectName
    .replace(/^VCE\s+VET\s+/i, "")
    .replace(/^VCE\s+VM\s+/i, "")
    .replace(/^VCE\s+/i, "")
    .trim();
  const withoutStudies = withoutPrefixes.replace(/\s+Studies$/i, "").trim();
  const afterColon = withoutPrefixes.includes(":") ? withoutPrefixes.split(":").pop()?.trim() : "";
  const words = importantWords(subjectName);
  const acronym = words.length >= 2 && words.length <= 5 ? words.map((word) => word[0]).join("") : "";

  return Array.from(
    new Set(
      [
        subjectName,
        withoutPrefixes,
        withoutStudies,
        afterColon,
        acronym.length >= 2 && acronym.length <= 5 ? acronym : "",
        ...(aliasOverrides[subjectName] ?? [])
      ]
        .map((alias) => alias?.trim())
        .filter((alias): alias is string => Boolean(alias && alias.length >= 2))
    )
  );
};

const scorePatterns = (question: string, signals: WeightedPattern[] = []) =>
  signals.reduce((score, signal) => score + (signal.pattern.test(question) ? signal.weight : 0), 0);

const scoreAliases = (question: string, aliases: string[]) =>
  aliases.reduce((score, alias) => {
    if (!hasPhrase(question, alias)) return score;
    return score + Math.min(14, 5 + importantWords(alias).length * 2);
  }, 0);

export const inferVceSubjectFromQuestion = (question: string) => {
  const ranked = vceSubjectCatalogue
    .map((subject) => {
      const aliasScore = scoreAliases(question, generatedAliasesFor(subject.name));
      const subjectScore = scorePatterns(question, subjectSignals[subject.name]);
      const categoryScore = scorePatterns(question, categorySignals[subject.category]);
      return {
        subject,
        explicit: aliasScore >= 5,
        score: aliasScore + subjectScore + categoryScore
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.subject.name.localeCompare(b.subject.name));

  const best = ranked[0];
  const next = ranked[1];
  if (!best) return null;
  const threshold = best.explicit ? 5 : 6;
  if (best.score < threshold) return null;
  if (next && best.score - next.score < 2) return null;

  const officialMeta = subjectMetaFor(best.subject.name);
  return officialMeta?.name ?? best.subject.name;
};
