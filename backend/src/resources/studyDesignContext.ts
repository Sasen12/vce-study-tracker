type StudyDesignContext = {
  source: string;
  context: string;
  detailLevel: "detailed" | "generic";
};

type DetailedStudyDesignContext = Omit<StudyDesignContext, "detailLevel">;

const appliedComputingSource =
  "VCAA VCE Applied Computing Study Design, accreditation from 2025. Local DOCX: backend/src/resources/study-designs/applied-computing-study-design.docx";
const biologySource =
  "VCAA VCE Biology Study Design, implementation from 2022. Official DOCX: https://vcaacorporateprod.prod.acquia-sites.com/sites/default/files/2025-10/2022BiologySD.docx";
const vceStudyDesignListSource =
  "VCAA VCE Study Designs list, 2026. Official index: https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/vce-study-designs";

const vcaaBaseUrl = "https://www.vcaa.vic.edu.au";

const officialStudyDesignSources: Record<string, string> = {
  English: "/curriculum/vce-curriculum/vce-study-designs/english-and-english-additional-language/english-and-english-additional-language-eal",
  "English as an Additional Language": "/curriculum/vce-curriculum/vce-study-designs/english-and-english-additional-language/english-and-english-additional-language-eal",
  "English Language": "/curriculum/vce-curriculum/vce-study-designs/english-language/english-language",
  Literature: "/curriculum/vce-curriculum/vce-study-designs/literature/vce-literature",
  "Foundation Mathematics": "/curriculum/vce-curriculum/vce-study-designs/foundation-mathematics/vce-foundation-mathematics",
  "General Mathematics": "/curriculum/vce-curriculum/vce-study-designs/general-mathematics/vce-general-mathematics",
  "Mathematical Methods": "/curriculum/vce-curriculum/vce-study-designs/mathematical-methods/vce-mathematical-methods",
  "Specialist Mathematics": "/curriculum/vce-curriculum/vce-study-designs/specialist-mathematics/vce-specialist-mathematics",
  Algorithmics: "/curriculum/vce-curriculum/vce-study-designs/algorithms-hess/vce-algorithmics-hess",
  "Agricultural and Horticultural Studies": "/curriculum/vce-curriculum/vce-study-designs/agricultural-and-horticultural-studies/agricultural-and-horticultural-studies",
  Biology: "/curriculum/vce-curriculum/vce-study-designs/biology/biology",
  Chemistry: "/curriculum/vce-curriculum/vce-study-designs/chemistry/chemistry",
  "Environmental Science": "/curriculum/vce-curriculum/vce-study-designs/environmental-science/environmental-science",
  Physics: "/curriculum/vce-curriculum/vce-study-designs/physics/physics",
  Psychology: "/curriculum/vce-curriculum/vce-study-designs/psychology/vce-psychology",
  "Applied Computing": "/curriculum/vce-curriculum/vce-study-designs/applied-computing-data-analytics/applied-computing",
  "Data Analytics": "/curriculum/vce-curriculum/vce-study-designs/applied-computing-data-analytics/applied-computing",
  "Software Development": "/curriculum/vce-curriculum/vce-study-designs/applied-computing-data-analytics/applied-computing",
  "Product Design and Technologies": "/curriculum/vce-curriculum/vce-study-designs/product-design-and-technologies/product-design-and-technologies",
  "Food Studies": "/curriculum/vce-curriculum/vce-study-designs/food-studies/vce-food-studies",
  "Systems Engineering": "/curriculum/vce-curriculum/vce-study-designs/system-engineering/systems-engineering",
  Accounting: "/curriculum/vce-curriculum/vce-study-designs/accounting/accounting",
  "Ancient History": "/curriculum/vce-curriculum/vce-study-designs/history-ancient/history",
  "Australian and Global Politics": "/curriculum/vce-curriculum/vce-study-designs/politics/vce-politics",
  "Australian History": "/curriculum/vce-curriculum/vce-study-designs/history-ancient/history",
  "Business Management": "/curriculum/vce-curriculum/vce-study-designs/business-management/vce-business-management",
  "Classical Studies": "/curriculum/vce-curriculum/vce-study-designs/classical-studies/classical-studies",
  Economics: "/curriculum/vce-curriculum/vce-study-designs/economics/vce-economics",
  "Extended Investigation": "/curriculum/vce-curriculum/vce-study-designs/extended-investigation/extended-investigation",
  Geography: "/curriculum/vce-curriculum/vce-study-designs/geography/geography",
  "Global Politics": "/curriculum/vce-curriculum/vce-study-designs/politics/vce-politics",
  History: "/curriculum/vce-curriculum/vce-study-designs/history-ancient/history",
  "History: Revolutions": "/curriculum/vce-curriculum/vce-study-designs/history-ancient/history",
  "Industry and Enterprise": "/curriculum/vce-curriculum/vce-study-designs/industry-and-enterprise/industry-and-enterprise",
  "Legal Studies": "/curriculum/vce-curriculum/vce-study-designs/legal-studies/legal-studies",
  Philosophy: "/curriculum/vce-curriculum/vce-study-designs/philosophy/philosophy",
  "Religion and Society": "/curriculum/vce-curriculum/vce-study-designs/religion-and-society/vce-religion-and-society",
  Sociology: "/curriculum/vce-curriculum/vce-study-designs/sociology/sociology",
  "Texts and Traditions": "/curriculum/vce-curriculum/vce-study-designs/texts-and-traditions/vce-texts-and-traditions",
  "Health and Human Development": "/curriculum/vce-curriculum/vce-study-designs/health-and-human-development/health-and-human-development",
  "Outdoor and Environmental Studies": "/curriculum/vce-curriculum/vce-study-designs/outdoor-and-environmental-studies/outdoor-and-environmental-studies",
  "Physical Education": "/curriculum/vce-curriculum/vce-study-designs/physical-education/physical-education",
  "Art Creative Practice": "/curriculum/vce-curriculum/vce-study-designs/art-creative-practice/vce-art-creative-practice",
  "Art Making and Exhibiting": "/curriculum/vce-curriculum/vce-study-designs/art-making-and-exhibiting/vce-art-making-and-exhibiting",
  Dance: "/curriculum/vce-curriculum/vce-study-designs/dance/dance",
  Drama: "/curriculum/vce-curriculum/vce-study-designs/drama/drama",
  Media: "/curriculum/vce-curriculum/vce-study-designs/media/media",
  Music: "/curriculum/vce-curriculum/vce-study-designs/music/music",
  "Music Composition": "/curriculum/vce-curriculum/vce-study-designs/music/music",
  "Music Contemporary Performance": "/curriculum/vce-curriculum/vce-study-designs/music/music",
  "Music Inquiry": "/curriculum/vce-curriculum/vce-study-designs/music/music",
  "Music Repertoire Performance": "/curriculum/vce-curriculum/vce-study-designs/music/music",
  "Theatre Studies": "/curriculum/vce-curriculum/vce-study-designs/theatre-studies/vce-theatre-studies-study-design",
  "Visual Communication Design": "/curriculum/vce-curriculum/vce-study-designs/visual-communication-design/visual-communication-design",
  "VCE VM Literacy": "/curriculum/vce-curriculum/vce-study-designs/vce-vm-literacy/vce-vocational-major-literacy",
  "VCE VM Numeracy": "/curriculum/vce-curriculum/vce-study-designs/vce-vm-numeracy/vce-vocational-major-numeracy",
  "VCE VM Personal Development Skills": "/curriculum/vce-curriculum/vce-study-designs/vce-vm-personal-development-skills/vce-vocational-major-personal-development-skills",
  "VCE VM Work Related Skills": "/curriculum/vce-curriculum/vce-study-designs/vce-vm-work-related-skills/vce-vocational-major-work-related-skills",
  "VCE VET Agriculture, Horticulture, Conservation and Ecosystem Management": "/curriculum/vet/vce-vet-programs/vce-vet-agriculture-horticulture-conservation-and-ecosystem-management",
  "VCE VET Animal Care": "/curriculum/vet/vce-vet-programs/vce-vet-animal-care",
  "VCE VET Apparel, Fashion and Textiles": "/curriculum/vet/vce-vet-programs/vce-vet-apparel-fashion-and-textiles",
  "VCE VET Applied Language": "/curriculum/vet/vce-vet-programs/vce-vet-applied-language",
  "VCE VET Automotive": "/curriculum/vet/vce-vet-programs/vce-vet-automotive",
  "VCE VET Building and Construction": "/curriculum/vet/vce-vet-programs/vce-vet-building-and-construction",
  "VCE VET Business": "/curriculum/vet/vce-vet-programs/vce-vet-business",
  "VCE VET Cisco": "/curriculum/vet/vce-vet-programs/vce-vet-cisco",
  "VCE VET Civil Infrastructure": "/curriculum/vet/vce-vet-programs/vce-vet-civil-infrastructure",
  "VCE VET Community Services": "/curriculum/vet/vce-vet-programs/vce-vet-community-services",
  "VCE VET Creative and Digital Media": "/curriculum/vet/vce-vet-programs/vce-vet-creative-and-digital-media",
  "VCE VET Dance": "/curriculum/vet/vce-vet-programs/vce-vet-dance",
  "VCE VET Electrical Industry": "/curriculum/vet/vce-vet-programs/vce-vet-electrical-industry",
  "VCE VET Engineering": "/curriculum/vet/vce-vet-programs/vce-vet-engineering-studies",
  "VCE VET Equine Studies": "/curriculum/vet/vce-vet-programs/vce-vet-equine-studies",
  "VCE VET Events and Tourism": "/curriculum/vet/vce-vet-programs/vce-vet-events-and-tourism",
  "VCE VET Furnishing": "/curriculum/vet/vce-vet-programs/vce-vet-furnishing",
  "VCE VET Hair and Beauty": "/curriculum/vet/vce-vet-programs/vce-vet-hair-and-beauty",
  "VCE VET Health": "/curriculum/vet/vce-vet-programs/vce-vet-health",
  "VCE VET Hospitality": "/curriculum/vet/vce-vet-programs/vce-vet-hospitality",
  "VCE VET Hospitality: Cookery": "/curriculum/vet/vce-vet-programs/vce-vet-hospitality",
  "VCE VET Information and Communications Technology": "/curriculum/vet/vce-vet-programs/vce-vet-information-and-communications-technology",
  "VCE VET Integrated Technologies": "/curriculum/vet/vce-vet-programs/vce-vet-integrated-technologies",
  "VCE VET Laboratory Skills": "/curriculum/vet/vce-vet-programs/vce-vet-laboratory-skills",
  "VCE VET Music Industry": "/curriculum/vet/vce-vet-programs/vce-vet-music",
  "VCE VET Plumbing": "/curriculum/vet/vce-vet-programs/vce-vet-plumbing",
  "VCE VET Renewable Energy": "/curriculum/vet/vce-vet-programs/vce-vet-renewable-energy",
  "VCE VET Small Business": "/curriculum/vet/vce-vet-programs/vce-vet-small-business",
  "VCE VET Sport and Recreation": "/curriculum/vet/vce-vet-programs/vce-vet-sport-and-recreation",
  "VCE VET Visual Arts": "/curriculum/vet/vce-vet-programs/vce-vet-visual-arts"
};

const languageStudyDesignSource = "/curriculum/vce-curriculum/vce-study-designs/vce-study-designs-languages";

const officialStudyDesignUrlFor = (subject: string) => {
  const direct = officialStudyDesignSources[subject];
  if (direct) return `${vcaaBaseUrl}${direct}`;

  const normalised = subject.toLowerCase();
  if (
    /language|arabic|armenian|auslan|bengali|bosnian|chinese|chin hakha|greek|hebrew|croatian|dutch|filipino|french|german|hindi|hungarian|indonesian|italian|japanese|karen|khmer|korean|latin|macedonian|persian|polish|portuguese|punjabi|romanian|russian|serbian|sinhala|spanish|swedish|tamil|turkish|urdu|vietnamese|yiddish/.test(
      normalised
    )
  ) {
    return `${vcaaBaseUrl}${languageStudyDesignSource}`;
  }

  return `${vcaaBaseUrl}/curriculum/vce-curriculum/vce-study-designs/vce-study-designs`;
};

const officialSubjectSource = (subject: string) =>
  `Official VCAA source for ${subject}: ${officialStudyDesignUrlFor(subject)}. ${vceStudyDesignListSource}.`;

type SubjectProfile = {
  program?: "VCE" | "VCE VM" | "VCE VET";
  focus: string;
  prefer: string;
  avoid?: string;
};

const subjectProfiles: Record<string, SubjectProfile> = {
  "English Language": {
    focus:
      "English language structures, subsystems, metalanguage, spoken and written discourse, language variation, identity, contemporary Australian English and analytical commentary.",
    prefer:
      "metalanguage drills, short analytical commentaries, discourse-feature annotation, subsystem tables, contemporary examples, transcript analysis and precise expression repair",
    avoid: "generic essay plans that ignore linguistic evidence and metalanguage"
  },
  Literature: {
    focus:
      "close literary analysis, interpretation, form, structure, language, views and values, adaptations or transformations, literary perspectives and evidence-rich written responses.",
    prefer:
      "passage annotation, quote banks, interpretation comparisons, literary-perspective paragraphs, language/form analysis, timed close analysis and revision of contention and evidence",
    avoid: "plot summary without interpretation"
  },
  Algorithmics: {
    focus:
      "computational thinking, algorithms, data structures, abstraction, correctness, complexity, representation, decomposition and formal reasoning.",
    prefer:
      "algorithm traces, pseudocode, complexity comparisons, proof sketches, data-structure choices, edge-case testing and worked problem explanations",
    avoid: "software-project management tasks unless the student explicitly asks for them"
  },
  "Agricultural and Horticultural Studies": {
    focus:
      "agricultural and horticultural systems, plant and animal production, soils, climate, sustainability, biosecurity, technology use and practical investigation.",
    prefer:
      "system diagrams, case studies, practical-method evaluation, terminology repair, sustainability trade-off tables and data-response questions"
  },
  Chemistry: {
    focus:
      "chemical structures and properties, analytical techniques, reaction pathways, equilibrium, acids and bases, redox, fuels, organic chemistry, calculations and experimental design.",
    prefer:
      "balanced equations, worked calculations, conditions and assumptions, spectroscopy interpretation, reaction-pathway maps, practical-method critique and error logs"
  },
  "Environmental Science": {
    focus:
      "Earth systems, biodiversity, pollution, climate, energy, ecological change, resource use, sustainability, risk and scientific investigation.",
    prefer:
      "case-study evidence tables, data interpretation, system diagrams, cause-effect chains, experimental design checks and evaluation paragraphs"
  },
  Physics: {
    focus:
      "motion, fields, electricity, waves, light, matter, models, uncertainty, practical investigation, data analysis and mathematical reasoning.",
    prefer:
      "formula conditions, diagrams, unit checks, worked calculations, graph interpretation, practical-method critique and mistake logs"
  },
  Psychology: {
    focus:
      "nervous system processes, learning, memory, consciousness, sleep, mental wellbeing, research methods, ethics, data interpretation and biopsychosocial explanations.",
    prefer:
      "research-method drills, key-term repair, study design evaluation, data-response practice, compare/explain paragraphs and application to scenarios"
  },
  "Applied Computing": {
    focus:
      "the Applied Computing problem-solving methodology, data and information, programming, networks, cyber security, digital systems and solution evaluation.",
    prefer:
      "requirements tables, data dictionaries, pseudocode, test cases, design sketches, security justifications and evaluation criteria"
  },
  "Product Design and Technologies": {
    focus:
      "design processes, materials, production methods, sustainability, design briefs, evaluation criteria, testing, documentation and user needs.",
    prefer:
      "design-brief breakdowns, criteria tables, material/property comparisons, production plans, test logs, annotation prompts and evaluation paragraphs"
  },
  "Food Studies": {
    focus:
      "food systems, nutrition, food choice, food security, sustainability, preparation, sensory analysis, health messages and practical investigation.",
    prefer:
      "nutrition terminology repair, case studies, sensory-analysis tables, food-system diagrams, practical-method evaluation and applied short responses"
  },
  "Systems Engineering": {
    focus:
      "mechanical and electrotechnological systems, systems thinking, design, production, testing, diagnostics, control, energy and evaluation.",
    prefer:
      "system diagrams, fault-finding tables, input-process-output maps, testing logs, design justifications and applied scenario questions"
  },
  Accounting: {
    focus:
      "recording, reporting, budgeting, financial performance, accounting assumptions, qualitative characteristics, analysis and advice for businesses.",
    prefer:
      "transaction classification, ledger and report practice, ratio interpretation, budgeting tasks, advice paragraphs and correction of calculation errors"
  },
  "Ancient History": {
    focus:
      "ancient societies, historical sources, interpretations, evidence, continuity and change, significance, causes and consequences.",
    prefer:
      "source annotation, evidence tables, historian interpretation comparisons, short-answer plans and timed evidence-based paragraphs"
  },
  "Australian and Global Politics": {
    focus:
      "political actors, power, democracy, global cooperation and conflict, policy, international relations, case studies and contemporary evidence.",
    prefer:
      "case-study banks, concept definitions, source/evidence tables, compare/analyse/evaluate paragraphs and contemporary example repair"
  },
  "Australian History": {
    focus:
      "Australian historical change, evidence, perspectives, causes and consequences, historical significance and source interpretation.",
    prefer:
      "timeline repair, source annotation, evidence banks, perspective comparisons and timed analytical paragraphs"
  },
  "Classical Studies": {
    focus:
      "classical texts, material culture, societies, values, evidence, interpretation, context and comparison.",
    prefer:
      "text/source annotation, context tables, theme banks, evidence-based paragraphs and interpretation comparisons"
  },
  Economics: {
    focus:
      "markets, resource allocation, macroeconomic goals, policy, aggregate demand and supply, economic indicators, efficiency, equity and contemporary data.",
    prefer:
      "diagram practice, policy cause-effect chains, data interpretation, definition repair, contemporary example banks and evaluate paragraphs"
  },
  "Extended Investigation": {
    focus:
      "research question design, literature review, methodology, ethics, evidence, critical thinking, argument, presentation and evaluation.",
    prefer:
      "research-question refinement, source credibility checks, methodology tables, argument maps, presentation rehearsal and evaluation notes"
  },
  Geography: {
    focus:
      "places, spatial patterns, fieldwork, data, human-environment interactions, change, sustainability, maps and geographic concepts.",
    prefer:
      "map/data interpretation, fieldwork-method critique, case-study tables, spatial-pattern paragraphs and concept application"
  },
  "Global Politics": {
    focus:
      "global actors, power, sovereignty, cooperation, conflict, ethical issues, global challenges and contemporary case studies.",
    prefer:
      "actor-power tables, case-study banks, policy evaluation, source analysis, compare/analyse/evaluate response plans"
  },
  History: {
    focus:
      "historical sources, evidence, perspectives, causes and consequences, continuity and change, significance and argument.",
    prefer:
      "timeline repair, source analysis, evidence banks, historian interpretation comparisons and timed analytical paragraphs"
  },
  "History: Revolutions": {
    focus:
      "causes and consequences of revolution, revolutionary ideas, leaders, movements, crises, new regimes, source analysis and historical interpretations.",
    prefer:
      "cause-consequence chains, chronology repair, source annotation, historian view tables, evidence banks and timed revolution paragraphs"
  },
  "Industry and Enterprise": {
    focus:
      "workplace participation, enterprise skills, industry change, employability, project planning, reflection, communication and applied evidence.",
    prefer:
      "evidence logs, workplace scenario responses, skill reflection, project checkpoints, terminology repair and short applied tasks"
  },
  "Legal Studies": {
    focus:
      "legal foundations, rights, criminal and civil justice systems, institutions, law reform, case studies, principles of justice and evaluation.",
    prefer:
      "case/example banks, legal-term repair, compare/evaluate paragraphs, scenario application, justice-principle links and source-response practice"
  },
  Philosophy: {
    focus:
      "philosophical arguments, logic, concepts, objections, ethical and metaphysical questions, reasoning and text analysis.",
    prefer:
      "argument maps, objection-response tables, concept distinctions, close text analysis and concise evaluative paragraphs"
  },
  "Religion and Society": {
    focus:
      "religious traditions, beliefs, ethics, rituals, communities, social change, texts, meaning and evidence-based analysis.",
    prefer:
      "belief-practice links, tradition example banks, compare/evaluate paragraphs, source analysis and terminology repair"
  },
  Sociology: {
    focus:
      "social categories, culture, deviance, identity, community, social theory, research methods and evidence-based analysis.",
    prefer:
      "concept definitions, theory-example links, research-method critique, case-study tables and analytical paragraphs"
  },
  "Texts and Traditions": {
    focus:
      "religious and textual traditions, interpretation, context, themes, passages, commentaries and evidence.",
    prefer:
      "passage annotation, theme banks, context tables, interpretation comparison and text-based response plans"
  },
  "Health and Human Development": {
    focus:
      "health, wellbeing, development, health status data, health promotion, the Australian and global health systems, sustainability and equity.",
    prefer:
      "definition repair, data-response practice, model/framework tables, cause-effect chains, compare/evaluate paragraphs and example banks"
  },
  "Outdoor and Environmental Studies": {
    focus:
      "relationships with outdoor environments, environmental change, sustainability, risk, outdoor experiences, Indigenous perspectives and practical evidence.",
    prefer:
      "experience-evidence reflections, case studies, sustainability trade-off tables, terminology repair and applied short responses"
  },
  "Physical Education": {
    focus:
      "body systems, movement, energy systems, training principles, acute and chronic adaptations, skill acquisition, data and performance analysis.",
    prefer:
      "scenario application, data interpretation, training-plan critique, terminology repair, comparison tables and short-answer drills"
  },
  "Art Creative Practice": {
    focus:
      "creative practice, art process, personal ideas, artists, materials, techniques, interpretation, documentation and reflection.",
    prefer:
      "folio checkpoints, artist-reference tables, annotation prompts, visual-analysis paragraphs, process reflection and evaluation"
  },
  "Art Making and Exhibiting": {
    focus:
      "art making, materials, techniques, exhibition practice, curation, conservation, artists, audiences and documentation.",
    prefer:
      "exhibition-analysis notes, material trials, artist comparison, folio evidence logs, annotation and evaluation prompts"
  },
  Dance: {
    focus:
      "choreography, performance, safe dance practice, expressive intention, movement analysis, production elements and evaluation.",
    prefer:
      "rehearsal logs, movement motif analysis, choreographic intention paragraphs, performance feedback and terminology repair"
  },
  Drama: {
    focus:
      "dramatic elements, performance styles, devised and scripted work, expressive skills, stimulus development, production areas and evaluation.",
    prefer:
      "performance reflection, style/elements tables, rehearsal notes, character/intention prompts and evaluative paragraphs"
  },
  Media: {
    focus:
      "media forms, narratives, audiences, representations, production design, media codes and conventions, agency and regulation.",
    prefer:
      "code/convention annotation, production plans, audience-purpose tables, representation analysis and short evaluative responses"
  },
  Music: {
    focus:
      "music language, listening, performance, composition, interpretation, analysis, technique and expressive control.",
    prefer:
      "listening-analysis prompts, practice logs, technique checkpoints, terminology repair, repertoire notes and reflection tasks"
  },
  "Music Composition": {
    focus:
      "composition process, music language, creative intention, notation or production, development, reflection and analysis.",
    prefer:
      "motif development tasks, composition logs, listening references, technique experiments, notation checks and reflection prompts"
  },
  "Music Contemporary Performance": {
    focus:
      "contemporary performance, repertoire, style, technique, interpretation, rehearsal, ensemble skills and performance reflection.",
    prefer:
      "practice plans, repertoire analysis, style-feature tables, performance feedback, technique goals and reflection prompts"
  },
  "Music Inquiry": {
    focus:
      "music inquiry, research, performance or composition investigation, analysis, interpretation, creative process and evidence.",
    prefer:
      "inquiry-question refinement, listening notes, evidence logs, performance/composition checkpoints and analytical reflection"
  },
  "Music Repertoire Performance": {
    focus:
      "repertoire performance, interpretation, technique, expressive control, style, analysis, practice and performance reflection.",
    prefer:
      "repertoire maps, technique drills, interpretation notes, practice logs, feedback cycles and listening-analysis prompts"
  },
  "Theatre Studies": {
    focus:
      "script interpretation, production roles, theatre styles, performance, stagecraft, audience, context and evaluation.",
    prefer:
      "production-role checklists, script annotation, stagecraft analysis, rehearsal reflection and evaluative paragraphs"
  },
  "Visual Communication Design": {
    focus:
      "design process, visual language, communication needs, typography, layout, drawing, design fields, critique and presentation.",
    prefer:
      "design-brief breakdowns, visual-language annotation, thumbnail iterations, critique tables, presentation planning and evaluation"
  },
  "VCE VM Literacy": {
    program: "VCE VM",
    focus:
      "reading, writing, speaking, listening, digital and workplace communication, audience, purpose, text types and practical evidence.",
    prefer:
      "text-type planning, vocabulary repair, spoken rehearsal, workplace communication tasks, reflection and portfolio evidence"
  },
  "VCE VM Numeracy": {
    program: "VCE VM",
    focus:
      "practical numeracy, measurement, finance, data, shape, location, estimation, problem solving and real-world mathematical communication.",
    prefer:
      "worked practical examples, calculator steps, unit checks, budgeting/data tasks, visual representations and correction logs"
  },
  "VCE VM Personal Development Skills": {
    program: "VCE VM",
    focus:
      "personal identity, community, teamwork, leadership, health, wellbeing, project planning, reflection and applied evidence.",
    prefer:
      "reflection prompts, project checklists, evidence logs, scenario responses, teamwork plans and practical next actions"
  },
  "VCE VM Work Related Skills": {
    program: "VCE VM",
    focus:
      "career planning, workplace skills, employability, rights and responsibilities, workplace communication, industry research and applied evidence.",
    prefer:
      "resume/interview tasks, workplace scenario responses, industry research tables, evidence logs and reflection prompts"
  },
  "VCE VET Agriculture, Horticulture, Conservation and Ecosystem Management": {
    program: "VCE VET",
    focus:
      "practical agriculture, horticulture, conservation, ecosystem management, safety, equipment, sustainability and competency evidence.",
    prefer: "checklists, evidence logs, practical scenarios, safety steps, terminology repair and workplace reflection"
  },
  "VCE VET Animal Care": {
    program: "VCE VET",
    focus:
      "animal care routines, welfare, hygiene, safety, handling, observation, communication and workplace competency evidence.",
    prefer: "care checklists, scenario responses, safety/hygiene steps, terminology repair and evidence logs"
  },
  "VCE VET Apparel, Fashion and Textiles": {
    program: "VCE VET",
    focus:
      "textile production, design briefs, pattern and garment construction, equipment safety, quality checks and portfolio evidence.",
    prefer: "process checklists, material/property tables, production plans, quality-control logs and practical reflections"
  },
  "VCE VET Applied Language": {
    program: "VCE VET",
    focus:
      "applied workplace language, communication tasks, listening, speaking, reading, writing, cultural context and competency evidence.",
    prefer: "role-play rehearsal, vocabulary banks, workplace texts, short responses, correction logs and evidence checklists"
  },
  "VCE VET Automotive": {
    program: "VCE VET",
    focus:
      "automotive systems, tools, diagnostics, safety, servicing, technical terminology, procedures and competency evidence.",
    prefer: "fault-finding tables, safety steps, tool/procedure checklists, terminology repair and practical evidence logs"
  },
  "VCE VET Building and Construction": {
    program: "VCE VET",
    focus:
      "construction processes, plans, materials, tools, site safety, measurements, quality checks and competency evidence.",
    prefer: "site-safety checklists, measurement tasks, workflow plans, materials comparisons and evidence logs"
  },
  "VCE VET Business": {
    program: "VCE VET",
    focus:
      "business communication, customer service, workplace documents, administration, technology, teamwork and competency evidence.",
    prefer: "workplace scenarios, document checklists, communication repair, customer-service responses and evidence logs"
  },
  "VCE VET Cisco": {
    program: "VCE VET",
    focus:
      "networking concepts, devices, addressing, configuration, troubleshooting, cybersecurity, documentation and competency evidence.",
    prefer: "network diagrams, command/checklist practice, troubleshooting tables, terminology repair and configuration evidence"
  },
  "VCE VET Civil Infrastructure": {
    program: "VCE VET",
    focus:
      "civil construction, plant/equipment, site safety, materials, measurements, environmental controls and competency evidence.",
    prefer: "safety checklists, workflow plans, measurement tasks, equipment notes and evidence logs"
  },
  "VCE VET Community Services": {
    program: "VCE VET",
    focus:
      "community support, communication, client needs, duty of care, safety, inclusion, reflection and competency evidence.",
    prefer: "scenario responses, communication scripts, rights/responsibility tables, reflection prompts and evidence logs"
  },
  "VCE VET Creative and Digital Media": {
    program: "VCE VET",
    focus:
      "digital media production, design process, briefs, software tools, audiences, technical skills, feedback and portfolio evidence.",
    prefer: "production plans, design-brief notes, asset checklists, critique logs, workflow checkpoints and reflection"
  },
  "VCE VET Dance": {
    program: "VCE VET",
    focus:
      "dance performance, rehearsal, safe practice, choreography, technique, industry expectations and competency evidence.",
    prefer: "rehearsal logs, safe-practice checklists, performance feedback, technique goals and evidence logs"
  },
  "VCE VET Electrical Industry": {
    program: "VCE VET",
    focus:
      "electrical safety, circuits, tools, measurements, diagrams, workplace procedures and competency evidence.",
    prefer: "safety steps, circuit diagrams, tool/procedure checklists, troubleshooting tables and evidence logs"
  },
  "VCE VET Engineering": {
    program: "VCE VET",
    focus:
      "engineering tools, materials, machining or fabrication processes, safety, measurements, drawings, testing and competency evidence.",
    prefer: "process plans, safety checklists, drawing interpretation, measurement checks, quality logs and evidence records"
  },
  "VCE VET Equine Studies": {
    program: "VCE VET",
    focus:
      "horse care, handling, safety, welfare, equipment, routines, observation and competency evidence.",
    prefer: "care checklists, safety steps, handling scenarios, terminology repair and evidence logs"
  },
  "VCE VET Events and Tourism": {
    program: "VCE VET",
    focus:
      "event planning, tourism services, customer communication, itineraries, risk, teamwork and competency evidence.",
    prefer: "planning checklists, customer scenarios, itinerary tasks, risk tables, reflection and evidence logs"
  },
  "VCE VET Furnishing": {
    program: "VCE VET",
    focus:
      "furnishing materials, tools, production processes, drawings, safety, quality checks and competency evidence.",
    prefer: "process checklists, material/tool tables, drawing interpretation, safety steps, quality logs and reflections"
  },
  "VCE VET Hair and Beauty": {
    program: "VCE VET",
    focus:
      "client consultation, hygiene, salon safety, treatments, products, communication, service quality and competency evidence.",
    prefer: "client scenarios, hygiene/safety checklists, product terminology, service workflows and evidence logs"
  },
  "VCE VET Health": {
    program: "VCE VET",
    focus:
      "health workplace communication, infection control, client support, safety, ethics, documentation and competency evidence.",
    prefer: "scenario responses, infection-control checklists, communication scripts, rights/responsibility tables and evidence logs"
  },
  "VCE VET Hospitality": {
    program: "VCE VET",
    focus:
      "hospitality service, food and beverage operations, hygiene, workplace safety, customer service, teamwork and competency evidence.",
    prefer: "service checklists, customer scenarios, hygiene/safety steps, workflow plans and evidence logs"
  },
  "VCE VET Information and Communications Technology": {
    program: "VCE VET",
    focus:
      "ICT support, systems, networking, software tools, troubleshooting, cybersecurity, documentation and competency evidence.",
    prefer: "troubleshooting tables, network/system diagrams, procedure checklists, terminology repair and evidence logs"
  },
  "VCE VET Integrated Technologies": {
    program: "VCE VET",
    focus:
      "integrated technology systems, electronics, control, tools, safety, troubleshooting, testing and competency evidence.",
    prefer: "system diagrams, safety checklists, fault-finding tables, testing logs and practical evidence records"
  },
  "VCE VET Laboratory Skills": {
    program: "VCE VET",
    focus:
      "laboratory procedures, safety, equipment, measurement, sampling, recording, quality control and competency evidence.",
    prefer: "method checklists, safety steps, data tables, equipment terminology, quality-control logs and practical scenarios"
  },
  "VCE VET Music Industry": {
    program: "VCE VET",
    focus:
      "music performance or sound production, industry practice, rehearsal, technical setup, collaboration and competency evidence.",
    prefer: "practice logs, setup checklists, performance feedback, terminology repair, workflow plans and evidence logs"
  },
  "VCE VET Plumbing": {
    program: "VCE VET",
    focus:
      "plumbing tools, materials, measurements, safety, plans, installation procedures, quality checks and competency evidence.",
    prefer: "safety steps, measurement tasks, procedure checklists, plan interpretation, quality logs and evidence records"
  },
  "VCE VET Renewable Energy": {
    program: "VCE VET",
    focus:
      "renewable energy systems, electrical safety, components, installation concepts, testing, sustainability and competency evidence.",
    prefer: "system diagrams, safety checklists, component tables, troubleshooting prompts and evidence logs"
  },
  "VCE VET Small Business": {
    program: "VCE VET",
    focus:
      "small business planning, customers, operations, finance basics, marketing, communication and competency evidence.",
    prefer: "business-plan checkpoints, customer scenarios, simple finance tasks, marketing notes and evidence logs"
  },
  "VCE VET Sport and Recreation": {
    program: "VCE VET",
    focus:
      "sport and recreation participation, coaching, safety, planning, communication, fitness or activity delivery and competency evidence.",
    prefer: "session plans, safety/risk checklists, coaching scenarios, reflection prompts and evidence logs"
  },
  "VCE VET Visual Arts": {
    program: "VCE VET",
    focus:
      "visual arts production, materials, techniques, briefs, presentation, critique, workplace practice and portfolio evidence.",
    prefer: "folio checklists, material trials, process reflection, critique prompts, presentation planning and evidence logs"
  }
};

const languageSubjects = new Set(
  [
    "Aboriginal Languages of Victoria",
    "Arabic",
    "Armenian",
    "Auslan",
    "Bengali",
    "Bosnian",
    "Chinese First Language",
    "Chinese Language, Culture and Society",
    "Chinese Second Language",
    "Chinese Second Language Advanced",
    "Chin Hakha",
    "Classical Greek",
    "Classical Hebrew",
    "Croatian",
    "Dutch",
    "Filipino",
    "French",
    "German",
    "Greek",
    "Hebrew",
    "Hindi",
    "Hungarian",
    "Indonesian First Language",
    "Indonesian Second Language",
    "Italian",
    "Japanese First Language",
    "Japanese Second Language",
    "Karen",
    "Khmer",
    "Korean First Language",
    "Korean Second Language",
    "Latin",
    "Macedonian",
    "Persian",
    "Polish",
    "Portuguese",
    "Punjabi",
    "Romanian",
    "Russian",
    "Serbian",
    "Sinhala",
    "Spanish",
    "Swedish",
    "Tamil",
    "Turkish",
    "Vietnamese First Language",
    "Vietnamese Second Language"
  ].map((subject) => subject.toLowerCase())
);

const contexts: Record<string, DetailedStudyDesignContext> = {
  English: {
    source: `${officialSubjectSource("English")} Local compact extract: backend/src/resources/study-designs/english-eal-study-design.docx`,
    context:
      "For VCE English Units 3 and 4, align work with Reading and responding to texts, Creating texts, and Analysing argument. For a 'frameworks' or 'framework of ideas' SAC, interpret this as Creating texts: develop and refine original writing in response to a Framework of Ideas, use mentor texts as models, make deliberate choices about form, audience, purpose and context, control voice and language features, draft and edit, and prepare a written explanation/commentary that justifies authorial choices. English study plans should not ask for formulas, calculation-style worked examples or generic concept maps. Prefer essay plans, contention/thesis work, paragraph scaffolds, quote/evidence banks, mentor text annotations, language-feature analysis, timed paragraphs, full timed responses, editing passes and written explanation practice. Avoid asking for unseen prescribed text knowledge unless the user supplies the text."
  },
  "English as an Additional Language": {
    source: `${officialSubjectSource("English as an Additional Language")} Local compact extract: backend/src/resources/study-designs/english-eal-study-design.docx`,
    context:
      "For VCE English as an Additional Language Units 3 and 4, align work with Reading and responding to texts, Creating texts, and Analysing argument, with explicit support for vocabulary, syntax, expression, evidence selection, audience, purpose and context. Prefer essay plans, quote/evidence banks, paragraph scaffolds, mentor text annotations, language-feature analysis, timed responses, oral/presentation rehearsal where relevant, editing passes and written explanation practice. Avoid generic formula or calculation language."
  },
  "Software Development": {
    source: `${officialSubjectSource("Software Development")} ${appliedComputingSource}`,
    context:
      "For VCE Software Development Units 3 and 4, align work with the Applied Computing problem-solving methodology, software development programming, analysis and design, development and evaluation, testing, validation, documentation, user-centred design, project planning, cybersecurity and data security concepts. Software Development study should produce technical artefacts: requirements tables, data dictionaries, designs, pseudocode, trace tables, test cases, validation notes, security justifications, evaluation criteria and marked scenario responses. Prefer scenario-based tasks that ask students to justify design choices, interpret requirements, write or trace pseudocode, evaluate solution effectiveness, and apply VCAA command terms."
  },
  "Data Analytics": {
    source: `${officialSubjectSource("Data Analytics")} ${appliedComputingSource}`,
    context:
      "For VCE Data Analytics Units 3 and 4, align work with data acquisition, data manipulation and cleansing, data analysis, statistical analysis, data visualisations, infographics or dynamic data visualisations, requirements, designs, project planning, evaluation, data security, cybersecurity and ethical handling of data. Data Analytics study should produce data dictionaries, cleaning logs, visualisation sketches/critiques, findings paragraphs, project-management notes, ethical/security justifications and evaluation responses. Prefer tasks using realistic datasets or organisational scenarios, with marking criteria for interpretation, justification and evaluation."
  },
  "Business Management": {
    source: `${officialSubjectSource("Business Management")} Local compact extract: backend/src/resources/study-designs/business-management-study-design.docx`,
    context:
      "For VCE Business Management Units 3 and 4, align work with managing a business and transforming a business. Include business foundations, stakeholders, objectives, management styles and skills, corporate culture, operations management, human resource management, motivation, training, performance management, key performance indicators, driving and restraining forces, change management strategies, leadership, CSR and contemporary business case studies. Business Management is not a formula subject. Study plans should avoid formula lists, calculation drills and economics-style graph work unless the student supplies a specific business maths prompt. Prefer business terminology banks, command-term unpacking, case-study application, stakeholder/KPI analysis, compare/analyse/evaluate paragraph drills, contemporary example banks, cause-effect chains, strategy evaluation tables, 6-10 mark response planning, and marked corrections using VCAA-style criteria."
  },
  "General Mathematics": {
    source: `${officialSubjectSource("General Mathematics")} Local compact extract: backend/src/resources/study-designs/mathematics-study-design.docx`,
    context:
      "For VCE General Mathematics Units 3 and 4, align work with data analysis, probability and statistics, recursion and financial modelling, matrices, networks and decision mathematics. General Mathematics study can include formulas, but should always pair them with conditions, worked examples, calculator/CAS steps where appropriate, interpretation, error logs and final conclusions in context. Prefer exam-style questions involving interpretation, multi-step calculations, technology-aware reasoning, clear working and final conclusions in context."
  },
  Biology: {
    source: `${officialSubjectSource("Biology")} ${biologySource}`,
    context:
      "For VCE Biology Units 3 and 4, use the VCAA Biology Study Design as the authority. If the student asks for Unit 3 Biology, do not drift into Unit 1 cellular regulation, homeostasis, organ systems or basic cell-cycle content unless they explicitly ask for prerequisite revision. Unit 3 is 'How do cells maintain life?'. Area of Study 1 is nucleic acids and proteins: DNA structure, mRNA/rRNA/tRNA, transcription, RNA processing in eukaryotes, translation, gene structure including exons, introns, promoter and operator regions, prokaryotic trp operon regulation, amino acids and protein structure, proteome, enzymes, protein export through rough ER/Golgi/vesicles, and DNA manipulation using polymerase, ligase, endonucleases, CRISPR-Cas9, PCR, gel electrophoresis, recombinant plasmids, bacterial transformation, insulin production, GM/transgenic organisms and agricultural applications. Area of Study 2 is biochemical pathways: structure and regulation of photosynthesis and cellular respiration, enzymes and coenzymes, temperature/pH/substrate concentration, competitive and non-competitive inhibitors, light-dependent and light-independent photosynthesis in C3 plants, Rubisco, C3/C4/CAM adaptations, limiting factors for photosynthesis, glycolysis/Krebs cycle/electron transport chain inputs/outputs/locations and ATP yield, anaerobic fermentation in animals and yeasts, respiration rate factors, CRISPR-Cas9 applications to photosynthetic efficiency and crop yield, and anaerobic fermentation of biomass for biofuel. Unit 4 is immunity, disease, evolution, allele-frequency change, relatedness and human change over time. Prefer VCAA-style data interpretation, bioethical issue evaluation, biological case studies, practical-method evaluation, command-term responses and marked corrections."
  },
  "Foundation Mathematics": {
    source: `${officialSubjectSource("Foundation Mathematics")} Local compact extract: backend/src/resources/study-designs/mathematics-study-design.docx`,
    context:
      "For VCE Foundation Mathematics Units 3 and 4, align study with practical numeracy, mathematical investigation, financial and consumer mathematics, measurement, data, graphs and models in everyday contexts. Prefer worked examples, calculator steps, visual representations, interpretation in context, short application questions and error logs."
  },
  "Mathematical Methods": {
    source: `${officialSubjectSource("Mathematical Methods")} Local compact extract: backend/src/resources/study-designs/mathematics-study-design.docx`,
    context:
      "For VCE Mathematical Methods Units 3 and 4, align study with functions, relations, calculus, algebra, probability and statistics. Prefer derivations or method cards, graph and transformation sketches, CAS-aware steps, conditions/domain notes, multi-step exam questions, exact reasoning, interpretation and a precise error log."
  },
  "Specialist Mathematics": {
    source: `${officialSubjectSource("Specialist Mathematics")} Local compact extract: backend/src/resources/study-designs/mathematics-study-design.docx`,
    context:
      "For VCE Specialist Mathematics Units 3 and 4, align study with advanced functions, complex numbers, vectors, mechanics, calculus, differential equations, probability and statistics. Prefer proof-like reasoning, clear notation, worked examples with conditions, mixed exam problems, modelling interpretation and correction logs."
  },
  "VCE VET Hospitality: Cookery": {
    source: `${officialSubjectSource("VCE VET Hospitality: Cookery")} VCAA notes this replaced VCE VET Hospitality: Kitchen Operations from 2024.`,
    context:
      "For VCE VET Hospitality: Cookery, align support with applied cookery competency evidence, food safety, hygiene, safe work practices, kitchen organisation, preparation techniques, cookery methods, recipe interpretation, mise en place, service timing, quality checks, cleaning and sustainability expectations. Prefer practical checklists, workflow plans, evidence logs, short applied scenarios, terminology repair, reflection prompts, service-readiness checks and task-by-task next actions. When generating questions, avoid generic VCE theory essays; make them workplace/practical and assessment-evidence focused unless the student asks for broader hospitality theory."
  }
};

const matches = (subject: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(subject));

const profileStudyDesignContext = (subject: string): StudyDesignContext | null => {
  const normalised = normaliseSubject(subject);
  const exactProfile =
    subjectProfiles[subject] ??
    Object.entries(subjectProfiles).find(([profileSubject]) => normaliseSubject(profileSubject) === normalised)?.[1];

  if (exactProfile) {
    const program = exactProfile.program ?? "VCE";
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context: `For ${program} ${subject}, use the current VCAA study design or program requirements as the authority. Local subject-specific coaching context: ${exactProfile.focus} Prefer ${exactProfile.prefer}.${exactProfile.avoid ? ` Avoid ${exactProfile.avoid}.` : ""} Keep advice active and assessable, and do not invent exact dot points unless the student's uploaded notes, screenshots or resources support them.`
    };
  }

  if (languageSubjects.has(normalised)) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context: `For VCE ${subject} Units 3 and 4, use the relevant VCAA language study design as the authority. Local subject-specific coaching context: interpret spoken, written and visual texts; communicate in ${subject}; analyse culture, audience, purpose and context; build vocabulary, grammar, text-type control and exam-ready expression. Prefer vocabulary banks, grammar repair, listening/reading annotation, model responses, timed writing, oral rehearsal where applicable and correction logs. Do not invent prescribed themes or exact assessment requirements unless the student's uploaded materials support them.`
    };
  }

  return null;
};

const genericStudyDesignContext = (subject: string): StudyDesignContext => {
  const profile = profileStudyDesignContext(subject);
  if (profile) return profile;

  if (matches(subject, [/language|arabic|armenian|auslan|bengali|bosnian|chinese|chin hakha|greek|hebrew|croatian|dutch|filipino|french|german|hindi|hungarian|indonesian|italian|japanese|karen|khmer|korean|latin|macedonian|persian|polish|portuguese|punjabi|romanian|russian|serbian|sinhala|spanish|swedish|tamil|turkish|urdu|vietnamese|yiddish/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with the relevant VCAA language study design: interpret spoken, written and visual texts; communicate in the language; analyse culture and context; build vocabulary, grammar and text-type control; and practise exam-style listening, reading, writing and speaking tasks where applicable. Prefer vocabulary banks, grammar repair, model responses, timed writing, oral rehearsal, text annotation and correction logs.`
    };
  }

  if (matches(subject, [/biology|chemistry|physics|psychology|environmental science|agricultural/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with scientific understanding, investigation skills, data interpretation, terminology, experimental design and exam-style explanation. Prefer concept repair, diagrams, practical-method reasoning, data/table interpretation, command-term responses, mixed exam questions and correction logs.`
    };
  }

  if (matches(subject, [/accounting|economics|legal|geography|history|politics|philosophy|religion|sociology|classical|traditions|extended investigation/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with key knowledge, key skills, evidence, source/case analysis and VCAA command terms. Prefer terminology banks, evidence/source tables, short-answer plans, compare/analyse/evaluate paragraphs, timed responses and marked corrections.`
    };
  }

  if (matches(subject, [/health|physical education|outdoor/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with key terms, models, data interpretation, case studies, application to populations or performance contexts, and VCAA command terms. Prefer summary tables, applied examples, data-response practice, short-answer drills and correction logs.`
    };
  }

  if (matches(subject, [/art|dance|drama|media|music|theatre|visual communication/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with creative process, analysis, terminology, folio or performance development, artist/practitioner examples, audience, purpose, context and evaluation. Prefer production planning, annotation, critique paragraphs, terminology banks, rehearsal/revision tasks and reflective corrections.`
    };
  }

  if (matches(subject, [/food|product design|systems engineering|technology|automotive|building|construction|engineering|digital|fashion|furnishing|plumbing|laboratory/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For VCE ${subject} Units 3 and 4, align study with design/problem-solving process, materials or systems knowledge, safety, criteria, testing, evaluation, documentation and applied scenario questions. Prefer design briefs, process notes, test tables, justification paragraphs, project checkpoints and marked corrections.`
    };
  }

  if (matches(subject, [/vce vm|vet/i])) {
    return {
      source: officialSubjectSource(subject),
      detailLevel: "generic",
      context:
        `For ${subject}, align study with applied evidence, workplace or vocational competencies, portfolio artefacts, reflective practice and task completion. Prefer checklists, evidence logs, applied scenarios, short reflections, oral rehearsal where relevant and practical next actions.`
    };
  }

  return {
    source: officialSubjectSource(subject),
    detailLevel: "generic",
    context:
      `For VCE ${subject} Units 3 and 4, use the current VCAA study design as the authority. Keep tasks active and assessable: key knowledge recall, applied examples, exam-style questions, marking criteria, corrections and a clear next step.`
  };
};

const normaliseSubject = (subject: string) => subject.trim().toLowerCase();

const detailedStudyDesignContext = (context: DetailedStudyDesignContext): StudyDesignContext => ({
  ...context,
  detailLevel: "detailed"
});

export const getStudyDesignContext = (subject: string) => {
  const direct = contexts[subject];
  if (direct) return detailedStudyDesignContext(direct);

  const normalised = normaliseSubject(subject);
  if (normalised === "bio" || normalised === "vce bio" || normalised === "vce biology") {
    return detailedStudyDesignContext(contexts.Biology);
  }
  if (normalised === "vet cookery" || normalised === "vce vet cookery" || normalised === "cookery") {
    return detailedStudyDesignContext(contexts["VCE VET Hospitality: Cookery"]);
  }

  return genericStudyDesignContext(subject);
};
