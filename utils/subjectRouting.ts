import { VCE_SUBJECTS, type VceSubjectCategory } from "@/constants/vceSubjects";
import type { UserSubject } from "@/types";

type WeightedPattern = {
  pattern: RegExp;
  weight: number;
};

type SubjectProfile = {
  aliases?: string[];
  signals?: WeightedPattern[];
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
  Algorithmics: ["algorithms", "algorithmics hess"],
  "Agricultural and Horticultural Studies": ["agriculture", "horticulture", "ag hort"],
  "Environmental Science": ["enviro science", "environmental"],
  "Applied Computing": ["applied computing", "computing"],
  "Data Analytics": ["data analysis", "analytics", "infographics", "infographic"],
  "Software Development": ["software dev", "soft dev", "programming"],
  "Product Design and Technologies": ["product design", "pdt"],
  "Food Studies": ["food tech", "food"],
  "Systems Engineering": ["systems"],
  "Business Management": ["busman", "business"],
  "Australian and Global Politics": ["australian politics"],
  "History: Revolutions": ["revolutions", "history revolutions", "revs"],
  "Legal Studies": ["legal"],
  "Health and Human Development": ["hhd", "health"],
  "Outdoor and Environmental Studies": ["outdoor ed", "oes"],
  "Physical Education": ["physical ed"],
  "Art Creative Practice": ["creative practice"],
  "Art Making and Exhibiting": ["art making", "exhibiting"],
  "Visual Communication Design": ["viscom", "visual communication", "vcd"],
  "VCE VM Literacy": ["vm literacy"],
  "VCE VM Numeracy": ["vm numeracy"],
  "VCE VM Personal Development Skills": ["pds", "personal development"],
  "VCE VM Work Related Skills": ["wrs", "work related"],
  "VCE VET Hospitality: Cookery": ["cookery", "kitchen operations"],
  "VCE VET Information and Communications Technology": ["vet ict", "ict"],
  "VCE VET Creative and Digital Media": ["creative digital media", "digital media"],
  "VCE VET Sport and Recreation": ["sport recreation"],
  "VCE VET Agriculture, Horticulture, Conservation and Ecosystem Management": ["vet agriculture", "ecosystem management"],
  "VCE VET Apparel, Fashion and Textiles": ["fashion textiles", "apparel"],
  "VCE VET Building and Construction": ["building construction"],
  "VCE VET Events and Tourism": ["events tourism"],
  "VCE VET Hair and Beauty": ["hair beauty"],
  "VCE VET Music Industry": ["music industry"],
  "VCE VET Renewable Energy": ["renewable energy"],
  "VCE VET Small Business": ["small business"],
  "VCE VET Visual Arts": ["visual arts"]
};

const subjectProfiles: Record<string, SubjectProfile> = {
  English: {
    signals: [
      { pattern: /\bargument analysis|language analysis|text response|comparative|contention|framework of ideas\b/i, weight: 7 },
      { pattern: /\bessay|thesis|topic sentence|body paragraph|quote analysis|authorial choice\b/i, weight: 4 }
    ]
  },
  "English Language": {
    signals: [
      { pattern: /\bsubsystem|metalanguage|discourse|phonology|morphology|syntax|lexicology|semantics\b/i, weight: 7 },
      { pattern: /\banalytical commentary|spoken discourse|written discourse|identity and language\b/i, weight: 5 }
    ]
  },
  Literature: {
    signals: [
      { pattern: /\bliterary perspective|close analysis|passage analysis|views and values|interpretation\b/i, weight: 6 },
      { pattern: /\bpoem|novel|play|prose|literary form|symbolism\b/i, weight: 3 }
    ]
  },
  "Foundation Mathematics": {
    signals: [{ pattern: /\bconsumer maths|measurement|practical numeracy|budget|estimate\b/i, weight: 5 }]
  },
  "General Mathematics": {
    signals: [
      { pattern: /\bmatrix|matrices|recursion|financial maths|annuit(?:y|ies)|networks?|critical path\b/i, weight: 7 },
      { pattern: /\bminimum spanning tree|maximum flow|transition matrix|depreciation|compound interest\b/i, weight: 7 }
    ]
  },
  "Mathematical Methods": {
    signals: [
      { pattern: /\bcalculus|derivative|integral|anti-derivative|function|probability density|normal distribution\b/i, weight: 6 },
      { pattern: /\bchain rule|product rule|quotient rule|stationary point|turning point|domain|range\b/i, weight: 5 }
    ]
  },
  "Specialist Mathematics": {
    signals: [
      { pattern: /\bcomplex numbers?|vectors?|mechanics|differential equation|kinematics|proof\b/i, weight: 6 },
      { pattern: /\bargand|imaginary|real part|acceleration vector|force diagram\b/i, weight: 6 }
    ]
  },
  Algorithmics: {
    signals: [{ pattern: /\balgorithm|complexity|data structure|graph theory|pseudocode|computational thinking\b/i, weight: 7 }]
  },
  "Agricultural and Horticultural Studies": {
    signals: [{ pattern: /\bagriculture|horticulture|soil|crop|livestock|biosecurity|farm|plant production\b/i, weight: 6 }]
  },
  Biology: {
    signals: [
      { pattern: /\bcell|cells|dna|rna|enzyme|photosynthesis|respiration|homeostasis|immune|evolution\b/i, weight: 5 },
      { pattern: /\bgene|genetic|allele|mutation|protein synthesis|pathogen|antibody|crispr\b/i, weight: 5 }
    ]
  },
  Chemistry: {
    signals: [
      { pattern: /\bmole|molar|stoichiometry|titration|oxidation|reduction|enthalpy|hydrocarbon\b/i, weight: 6 },
      { pattern: /\bacid|base|covalent|ionic|equilibrium|reaction rate|organic chemistry|spectroscopy\b/i, weight: 5 }
    ]
  },
  "Environmental Science": {
    signals: [{ pattern: /\bbiodiversity|ecosystem|pollution|climate|sustainability|environmental impact|energy use\b/i, weight: 6 }]
  },
  Physics: {
    signals: [
      { pattern: /\bforce|velocity|acceleration|momentum|energy|power|circuit|voltage|current\b/i, weight: 5 },
      { pattern: /\bnewton|magnetic field|electric field|wave|frequency|gravity|projectile\b/i, weight: 5 }
    ]
  },
  Psychology: {
    signals: [
      { pattern: /\bbrain|neuron|memory|learning|conditioning|sleep|stress|mental health\b/i, weight: 5 },
      { pattern: /\bamygdala|hippocampus|classical conditioning|operant conditioning|consciousness\b/i, weight: 5 }
    ]
  },
  "Applied Computing": {
    signals: [{ pattern: /\bcomputing|digital system|network|cybersecurity|programming|data and information\b/i, weight: 5 }]
  },
  "Data Analytics": {
    signals: [
      { pattern: /\bdata analytics|data analysis|applied computing\b/i, weight: 8 },
      { pattern: /\binfographic|data visuali[sz]ation|dashboard|chart|graph|axis|axes|visual hierarchy\b/i, weight: 6 },
      { pattern: /\bevaluation criteria|efficiency|effectiveness|target audience|research question\b/i, weight: 5 },
      { pattern: /\bBOM\b|Climate Data Online|Melbourne Airport Station|cleaned BOM|temperature data\b/i, weight: 7 },
      { pattern: /\bdata acquisition|data cleansing|data cleaning|data dictionary|metadata|data integrity\b/i, weight: 5 }
    ]
  },
  "Software Development": {
    signals: [
      { pattern: /\balgorithm|pseudocode|program|code|function|trace table|test case|validation\b/i, weight: 6 },
      { pattern: /\brequirements|software design|data dictionary|user interface|cybersecurity|evaluation criteria\b/i, weight: 5 }
    ]
  },
  "Product Design and Technologies": {
    signals: [{ pattern: /\bdesign brief|product design|materials?|prototype|production plan|evaluation criteria\b/i, weight: 6 }]
  },
  "Food Studies": {
    signals: [{ pattern: /\bnutrition|food system|sensory analysis|food security|diet|recipe|health message\b/i, weight: 6 }]
  },
  "Systems Engineering": {
    signals: [{ pattern: /\bmechanical system|electrotechnology|circuit|control system|systems diagram|fault finding\b/i, weight: 6 }]
  },
  Accounting: {
    signals: [
      { pattern: /\bbalance sheet|income statement|ledger|journal entry|debit|credit|accounts receivable|accounts payable\b/i, weight: 7 },
      { pattern: /\bassets|liabilities|equity|cash flow|gross profit|net profit|inventory turnover\b/i, weight: 5 }
    ]
  },
  "Ancient History": {
    signals: [{ pattern: /\bancient|rome|roman|greece|greek|egypt|pharaoh|archaeological|primary source\b/i, weight: 6 }]
  },
  "Australian and Global Politics": {
    signals: [{ pattern: /\bpower|democracy|global actor|international relations|sovereignty|policy|political\b/i, weight: 5 }]
  },
  "Australian History": {
    signals: [{ pattern: /\baustralian history|australia|federation|colonial|indigenous history|anzac\b/i, weight: 6 }]
  },
  "Business Management": {
    signals: [
      { pattern: /\bbusiness management|management style|management skill|stakeholder|corporate culture\b/i, weight: 7 },
      { pattern: /\boperations management|human resources|employee|motivation|kpi|key performance indicator\b/i, weight: 6 },
      { pattern: /\bswot|porter|change management|leadership|business objective|strategy\b/i, weight: 5 }
    ]
  },
  "Classical Studies": {
    signals: [{ pattern: /\bclassical|ancient text|material culture|classical society|mythology|greco-roman\b/i, weight: 6 }]
  },
  Economics: {
    signals: [
      { pattern: /\bsupply and demand|aggregate demand|aggregate supply|inflation|gdp|monetary policy|fiscal policy\b/i, weight: 7 },
      { pattern: /\bexchange rate|unemployment|scarcity|opportunity cost|market failure|elasticity\b/i, weight: 5 }
    ]
  },
  "Extended Investigation": {
    signals: [{ pattern: /\bresearch question|methodology|literature review|ethics|primary research|secondary research\b/i, weight: 5 }]
  },
  Geography: {
    signals: [
      { pattern: /\bgeography|fieldwork|spatial|map|mapping|land use|urban|liveability|sustainability\b/i, weight: 6 },
      { pattern: /\bfed square|federation square|melbourne cbd|place|scale|distribution|human environment\b/i, weight: 6 }
    ]
  },
  "Global Politics": {
    signals: [{ pattern: /\bglobal politics|global actor|sovereignty|international law|conflict|cooperation|human rights\b/i, weight: 6 }]
  },
  History: {
    signals: [{ pattern: /\bhistory|historical source|continuity and change|cause and consequence|historian|primary source\b/i, weight: 5 }]
  },
  "History: Revolutions": {
    signals: [{ pattern: /\brevolution|revolutions|french revolution|russian revolution|china revolution|crisis|new regime\b/i, weight: 7 }]
  },
  "Industry and Enterprise": {
    signals: [{ pattern: /\bindustry|enterprise|employability|workplace|project planning|work skills\b/i, weight: 5 }]
  },
  "Legal Studies": {
    signals: [
      { pattern: /\bconstitution|parliament|court|justice|law reform|precedent|statutory interpretation\b/i, weight: 6 },
      { pattern: /\bcivil|criminal|rights|remedy|sanction|jury|high court|principles of justice\b/i, weight: 5 }
    ]
  },
  Philosophy: {
    signals: [{ pattern: /\bphilosophy|argument|logic|objection|premise|conclusion|ethics|metaphysics\b/i, weight: 6 }]
  },
  "Religion and Society": {
    signals: [{ pattern: /\breligion|religious tradition|belief|ritual|ethics|sacred text|community\b/i, weight: 5 }]
  },
  Sociology: {
    signals: [{ pattern: /\bsociology|culture|identity|deviance|social theory|community|social research\b/i, weight: 6 }]
  },
  "Texts and Traditions": {
    signals: [{ pattern: /\btextual tradition|sacred text|passage analysis|commentary|religious text|tradition\b/i, weight: 6 }]
  },
  "Health and Human Development": {
    signals: [{ pattern: /\bhealth status|wellbeing|human development|health promotion|sustainable development|equity\b/i, weight: 6 }]
  },
  "Outdoor and Environmental Studies": {
    signals: [{ pattern: /\boutdoor environment|outdoor experience|risk|environmental change|indigenous perspective|parks\b/i, weight: 6 }]
  },
  "Physical Education": {
    signals: [{ pattern: /\benergy systems?|training principles?|acute adaptation|chronic adaptation|skill acquisition|biomechanics\b/i, weight: 6 }]
  },
  "Art Creative Practice": {
    signals: [{ pattern: /\bcreative practice|art process|artist|artwork|folio|materials and techniques\b/i, weight: 5 }]
  },
  "Art Making and Exhibiting": {
    signals: [{ pattern: /\bexhibition|curation|conservation|art making|gallery|materials and techniques\b/i, weight: 6 }]
  },
  Dance: {
    signals: [{ pattern: /\bdance|choreography|movement|safe dance|expressive intention|performance\b/i, weight: 6 }]
  },
  Drama: {
    signals: [{ pattern: /\bdrama|dramatic elements|performance style|expressive skills|stagecraft|devised\b/i, weight: 6 }]
  },
  Media: {
    signals: [{ pattern: /\bmedia|narrative|representation|audience|media code|convention|production design\b/i, weight: 5 }]
  },
  Music: {
    signals: [{ pattern: /\bmusic|repertoire|listening analysis|composition|performance|expressive control\b/i, weight: 5 }]
  },
  "Theatre Studies": {
    signals: [{ pattern: /\btheatre|script interpretation|stagecraft|production role|audience|performance\b/i, weight: 6 }]
  },
  "Visual Communication Design": {
    signals: [{ pattern: /\bvisual communication|typography|layout|design field|visual language|design brief\b/i, weight: 7 }]
  },
  "VCE VM Literacy": {
    signals: [{ pattern: /\bliteracy|workplace text|reading|writing|speaking|listening|audience purpose\b/i, weight: 5 }]
  },
  "VCE VM Numeracy": {
    signals: [{ pattern: /\bnumeracy|measurement|budget|data|estimation|real-world maths|practical maths\b/i, weight: 5 }]
  },
  "VCE VM Personal Development Skills": {
    signals: [{ pattern: /\bpersonal development|community project|teamwork|leadership|wellbeing|reflection\b/i, weight: 5 }]
  },
  "VCE VM Work Related Skills": {
    signals: [{ pattern: /\bwork related|career|employability|resume|interview|workplace rights|industry research\b/i, weight: 5 }]
  }
};

const categorySignals: Record<VceSubjectCategory, WeightedPattern[]> = {
  English: [{ pattern: /\bessay|paragraph|contention|language|text|audience|purpose\b/i, weight: 1 }],
  Mathematics: [{ pattern: /\bcalculate|solve|equation|formula|graph|probability|statistics\b/i, weight: 2 }],
  Sciences: [{ pattern: /\bexperiment|hypothesis|variable|data table|practical report|scientific\b/i, weight: 2 }],
  Technology: [{ pattern: /\bdesign|test|criteria|evaluation|prototype|data|software|security\b/i, weight: 2 }],
  Humanities: [{ pattern: /\bcase study|source analysis|evidence|evaluate|compare|cause|consequence\b/i, weight: 1 }],
  "Health and PE": [{ pattern: /\bhealth|body|training|performance|population|wellbeing|risk\b/i, weight: 2 }],
  "The Arts": [{ pattern: /\bartist|performance|production|folio|creative|design|audience\b/i, weight: 2 }],
  Languages: [{ pattern: /\boral|listening|reading|writing|grammar|vocabulary|translation\b/i, weight: 1 }],
  "VCE VM": [{ pattern: /\bportfolio|applied|workplace|reflection|project|evidence\b/i, weight: 1 }],
  "VCE VET": [{ pattern: /\bcompetency|workplace|safety|procedure|evidence log|practical task\b/i, weight: 1 }]
};

const subjectMeta = new Map(VCE_SUBJECTS.map((subject) => [subject.name.toLowerCase(), subject]));

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasPhrase = (question: string, phrase: string) => {
  const clean = phrase.trim();
  if (!clean) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(clean)}([^a-z0-9]|$)`, "i").test(question);
};

const importantWords = (value: string) =>
  normalise(value)
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
    const wordCount = importantWords(alias).length;
    return score + Math.min(14, 5 + wordCount * 2);
  }, 0);

const scoreSubject = (question: string, subject: UserSubject, categoryCounts: Map<VceSubjectCategory, number>) => {
  const meta = subjectMeta.get(subject.subjectName.toLowerCase());
  const profile = subjectProfiles[subject.subjectName];
  const aliases = generatedAliasesFor(subject.subjectName);
  const aliasScore = scoreAliases(question, [...aliases, ...(profile?.aliases ?? [])]);
  const subjectScore = scorePatterns(question, profile?.signals);
  const categoryScore = meta ? scorePatterns(question, categorySignals[meta.category]) : 0;
  const uniqueCategoryBoost = meta && categoryScore > 0 && categoryCounts.get(meta.category) === 1 ? 2 : 0;

  return {
    subject,
    score: aliasScore + subjectScore + categoryScore + uniqueCategoryBoost,
    explicit: aliasScore >= 5
  };
};

export const smartSubjectForQuestion = (question: string, selectedSubject: UserSubject, subjects: UserSubject[]) => {
  const userSubjects = subjects.length ? subjects : [selectedSubject];
  const categoryCounts = userSubjects.reduce((counts, subject) => {
    const meta = subjectMeta.get(subject.subjectName.toLowerCase());
    if (meta) counts.set(meta.category, (counts.get(meta.category) ?? 0) + 1);
    return counts;
  }, new Map<VceSubjectCategory, number>());
  const ranked = userSubjects
    .map((subject) => scoreSubject(question, subject, categoryCounts))
    .sort((a, b) => b.score - a.score || a.subject.subjectName.localeCompare(b.subject.subjectName));
  const best = ranked[0];
  const selected = ranked.find((item) => item.subject.id === selectedSubject.id);
  const next = ranked[1];

  if (!best || best.subject.id === selectedSubject.id) return selectedSubject;
  const threshold = best.explicit ? 5 : 6;
  if (best.score < threshold) return selectedSubject;
  if (next && best.score - next.score < 2) return selectedSubject;
  if (selected && selected.score > 0 && best.score - selected.score < 3) return selectedSubject;

  return best.subject;
};
