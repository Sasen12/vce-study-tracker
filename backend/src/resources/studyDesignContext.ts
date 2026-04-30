type StudyDesignContext = {
  source: string;
  context: string;
};

const appliedComputingSource =
  "VCAA VCE Applied Computing Study Design, accreditation from 2025. Local DOCX: backend/src/resources/study-designs/applied-computing-study-design.docx";
const biologySource =
  "VCAA VCE Biology Study Design, implementation from 2022. Official DOCX: https://vcaacorporateprod.prod.acquia-sites.com/sites/default/files/2025-10/2022BiologySD.docx";
const vceStudyDesignListSource =
  "VCAA VCE Study Designs list, 2026. Use this as the current subject catalogue; detailed context is available for English/EAL, Biology, Applied Computing, Business Management and Mathematics.";

const contexts: Record<string, StudyDesignContext> = {
  English: {
    source:
      "VCAA VCE English and English as an Additional Language Study Design, Units 3 and 4 from 2024. Local DOCX: backend/src/resources/study-designs/english-eal-study-design.docx",
    context:
      "For VCE English Units 3 and 4, align work with Reading and responding to texts, Creating texts, and Analysing argument. For a 'frameworks' or 'framework of ideas' SAC, interpret this as Creating texts: develop and refine original writing in response to a Framework of Ideas, use mentor texts as models, make deliberate choices about form, audience, purpose and context, control voice and language features, draft and edit, and prepare a written explanation/commentary that justifies authorial choices. English study plans should not ask for formulas, calculation-style worked examples or generic concept maps. Prefer essay plans, contention/thesis work, paragraph scaffolds, quote/evidence banks, mentor text annotations, language-feature analysis, timed paragraphs, full timed responses, editing passes and written explanation practice. Avoid asking for unseen prescribed text knowledge unless the user supplies the text."
  },
  "English as an Additional Language": {
    source:
      "VCAA VCE English and English as an Additional Language Study Design, Units 3 and 4 from 2024. Local DOCX: backend/src/resources/study-designs/english-eal-study-design.docx",
    context:
      "For VCE English as an Additional Language Units 3 and 4, align work with Reading and responding to texts, Creating texts, and Analysing argument, with explicit support for vocabulary, syntax, expression, evidence selection, audience, purpose and context. Prefer essay plans, quote/evidence banks, paragraph scaffolds, mentor text annotations, language-feature analysis, timed responses, oral/presentation rehearsal where relevant, editing passes and written explanation practice. Avoid generic formula or calculation language."
  },
  "Software Development": {
    source: appliedComputingSource,
    context:
      "For VCE Software Development Units 3 and 4, align work with the Applied Computing problem-solving methodology, software development programming, analysis and design, development and evaluation, testing, validation, documentation, user-centred design, project planning, cybersecurity and data security concepts. Software Development study should produce technical artefacts: requirements tables, data dictionaries, designs, pseudocode, trace tables, test cases, validation notes, security justifications, evaluation criteria and marked scenario responses. Prefer scenario-based tasks that ask students to justify design choices, interpret requirements, write or trace pseudocode, evaluate solution effectiveness, and apply VCAA command terms."
  },
  "Data Analytics": {
    source: appliedComputingSource,
    context:
      "For VCE Data Analytics Units 3 and 4, align work with data acquisition, data manipulation and cleansing, data analysis, statistical analysis, data visualisations, infographics or dynamic data visualisations, requirements, designs, project planning, evaluation, data security, cybersecurity and ethical handling of data. Data Analytics study should produce data dictionaries, cleaning logs, visualisation sketches/critiques, findings paragraphs, project-management notes, ethical/security justifications and evaluation responses. Prefer tasks using realistic datasets or organisational scenarios, with marking criteria for interpretation, justification and evaluation."
  },
  "Business Management": {
    source:
      "VCAA VCE Business Management Study Design, accreditation from 2023. Local DOCX: backend/src/resources/study-designs/business-management-study-design.docx",
    context:
      "For VCE Business Management Units 3 and 4, align work with managing a business and transforming a business. Include business foundations, stakeholders, objectives, management styles and skills, corporate culture, operations management, human resource management, motivation, training, performance management, key performance indicators, driving and restraining forces, change management strategies, leadership, CSR and contemporary business case studies. Business Management is not a formula subject. Study plans should avoid formula lists, calculation drills and economics-style graph work unless the student supplies a specific business maths prompt. Prefer business terminology banks, command-term unpacking, case-study application, stakeholder/KPI analysis, compare/analyse/evaluate paragraph drills, contemporary example banks, cause-effect chains, strategy evaluation tables, 6-10 mark response planning, and marked corrections using VCAA-style criteria."
  },
  "General Mathematics": {
    source:
      "VCAA VCE Mathematics Study Design, accreditation from 2023. Local DOCX: backend/src/resources/study-designs/mathematics-study-design.docx",
    context:
      "For VCE General Mathematics Units 3 and 4, align work with data analysis, probability and statistics, recursion and financial modelling, matrices, networks and decision mathematics. General Mathematics study can include formulas, but should always pair them with conditions, worked examples, calculator/CAS steps where appropriate, interpretation, error logs and final conclusions in context. Prefer exam-style questions involving interpretation, multi-step calculations, technology-aware reasoning, clear working and final conclusions in context."
  },
  Biology: {
    source: biologySource,
    context:
      "For VCE Biology Units 3 and 4, use the VCAA Biology Study Design as the authority. If the student asks for Unit 3 Biology, do not drift into Unit 1 cellular regulation, homeostasis, organ systems or basic cell-cycle content unless they explicitly ask for prerequisite revision. Unit 3 is 'How do cells maintain life?'. Area of Study 1 is nucleic acids and proteins: DNA structure, mRNA/rRNA/tRNA, transcription, RNA processing in eukaryotes, translation, gene structure including exons, introns, promoter and operator regions, prokaryotic trp operon regulation, amino acids and protein structure, proteome, enzymes, protein export through rough ER/Golgi/vesicles, and DNA manipulation using polymerase, ligase, endonucleases, CRISPR-Cas9, PCR, gel electrophoresis, recombinant plasmids, bacterial transformation, insulin production, GM/transgenic organisms and agricultural applications. Area of Study 2 is biochemical pathways: structure and regulation of photosynthesis and cellular respiration, enzymes and coenzymes, temperature/pH/substrate concentration, competitive and non-competitive inhibitors, light-dependent and light-independent photosynthesis in C3 plants, Rubisco, C3/C4/CAM adaptations, limiting factors for photosynthesis, glycolysis/Krebs cycle/electron transport chain inputs/outputs/locations and ATP yield, anaerobic fermentation in animals and yeasts, respiration rate factors, CRISPR-Cas9 applications to photosynthetic efficiency and crop yield, and anaerobic fermentation of biomass for biofuel. Unit 4 is immunity, disease, evolution, allele-frequency change, relatedness and human change over time. Prefer VCAA-style data interpretation, bioethical issue evaluation, biological case studies, practical-method evaluation, command-term responses and marked corrections."
  },
  "Foundation Mathematics": {
    source:
      "VCAA VCE Mathematics Study Design, accreditation from 2023. Local DOCX: backend/src/resources/study-designs/mathematics-study-design.docx",
    context:
      "For VCE Foundation Mathematics Units 3 and 4, align study with practical numeracy, mathematical investigation, financial and consumer mathematics, measurement, data, graphs and models in everyday contexts. Prefer worked examples, calculator steps, visual representations, interpretation in context, short application questions and error logs."
  },
  "Mathematical Methods": {
    source:
      "VCAA VCE Mathematics Study Design, accreditation from 2023. Local DOCX: backend/src/resources/study-designs/mathematics-study-design.docx",
    context:
      "For VCE Mathematical Methods Units 3 and 4, align study with functions, relations, calculus, algebra, probability and statistics. Prefer derivations or method cards, graph and transformation sketches, CAS-aware steps, conditions/domain notes, multi-step exam questions, exact reasoning, interpretation and a precise error log."
  },
  "Specialist Mathematics": {
    source:
      "VCAA VCE Mathematics Study Design, accreditation from 2023. Local DOCX: backend/src/resources/study-designs/mathematics-study-design.docx",
    context:
      "For VCE Specialist Mathematics Units 3 and 4, align study with advanced functions, complex numbers, vectors, mechanics, calculus, differential equations, probability and statistics. Prefer proof-like reasoning, clear notation, worked examples with conditions, mixed exam problems, modelling interpretation and correction logs."
  },
  "VCE VET Hospitality: Cookery": {
    source:
      "VCAA VCE VET Hospitality: Cookery program information, current VCE VET subject list. VCAA notes this replaced VCE VET Hospitality: Kitchen Operations from 2024.",
    context:
      "For VCE VET Hospitality: Cookery, align support with applied cookery competency evidence, food safety, hygiene, safe work practices, kitchen organisation, preparation techniques, cookery methods, recipe interpretation, mise en place, service timing, quality checks, cleaning and sustainability expectations. Prefer practical checklists, workflow plans, evidence logs, short applied scenarios, terminology repair, reflection prompts, service-readiness checks and task-by-task next actions. When generating questions, avoid generic VCE theory essays; make them workplace/practical and assessment-evidence focused unless the student asks for broader hospitality theory."
  }
};

const matches = (subject: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(subject));

const genericStudyDesignContext = (subject: string): StudyDesignContext => {
  if (matches(subject, [/language|arabic|armenian|auslan|bengali|bosnian|chinese|chin hakha|greek|hebrew|croatian|dutch|filipino|french|german|hindi|hungarian|indonesian|italian|japanese|karen|khmer|korean|latin|macedonian|persian|polish|portuguese|punjabi|romanian|russian|serbian|sinhala|spanish|swedish|tamil|turkish|urdu|vietnamese|yiddish/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with the relevant VCAA language study design: interpret spoken, written and visual texts; communicate in the language; analyse culture and context; build vocabulary, grammar and text-type control; and practise exam-style listening, reading, writing and speaking tasks where applicable. Prefer vocabulary banks, grammar repair, model responses, timed writing, oral rehearsal, text annotation and correction logs.`
    };
  }

  if (matches(subject, [/biology|chemistry|physics|psychology|environmental science|agricultural/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with scientific understanding, investigation skills, data interpretation, terminology, experimental design and exam-style explanation. Prefer concept repair, diagrams, practical-method reasoning, data/table interpretation, command-term responses, mixed exam questions and correction logs.`
    };
  }

  if (matches(subject, [/accounting|economics|legal|geography|history|politics|philosophy|religion|sociology|classical|traditions|extended investigation/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with key knowledge, key skills, evidence, source/case analysis and VCAA command terms. Prefer terminology banks, evidence/source tables, short-answer plans, compare/analyse/evaluate paragraphs, timed responses and marked corrections.`
    };
  }

  if (matches(subject, [/health|physical education|outdoor/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with key terms, models, data interpretation, case studies, application to populations or performance contexts, and VCAA command terms. Prefer summary tables, applied examples, data-response practice, short-answer drills and correction logs.`
    };
  }

  if (matches(subject, [/art|dance|drama|media|music|theatre|visual communication/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with creative process, analysis, terminology, folio or performance development, artist/practitioner examples, audience, purpose, context and evaluation. Prefer production planning, annotation, critique paragraphs, terminology banks, rehearsal/revision tasks and reflective corrections.`
    };
  }

  if (matches(subject, [/food|product design|systems engineering|technology|automotive|building|construction|engineering|digital|fashion|furnishing|plumbing|laboratory/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For VCE ${subject} Units 3 and 4, align study with design/problem-solving process, materials or systems knowledge, safety, criteria, testing, evaluation, documentation and applied scenario questions. Prefer design briefs, process notes, test tables, justification paragraphs, project checkpoints and marked corrections.`
    };
  }

  if (matches(subject, [/vce vm|vet/i])) {
    return {
      source: vceStudyDesignListSource,
      context:
        `For ${subject}, align study with applied evidence, workplace or vocational competencies, portfolio artefacts, reflective practice and task completion. Prefer checklists, evidence logs, applied scenarios, short reflections, oral rehearsal where relevant and practical next actions.`
    };
  }

  return {
    source: vceStudyDesignListSource,
    context:
      `For VCE ${subject} Units 3 and 4, use the current VCAA study design as the authority. Keep tasks active and assessable: key knowledge recall, applied examples, exam-style questions, marking criteria, corrections and a clear next step.`
  };
};

const normaliseSubject = (subject: string) => subject.trim().toLowerCase();

export const getStudyDesignContext = (subject: string) => {
  const direct = contexts[subject];
  if (direct) return direct;

  const normalised = normaliseSubject(subject);
  if (normalised === "bio" || normalised === "vce bio" || normalised === "vce biology") {
    return contexts.Biology;
  }
  if (normalised === "vet cookery" || normalised === "vce vet cookery" || normalised === "cookery") {
    return contexts["VCE VET Hospitality: Cookery"];
  }

  return genericStudyDesignContext(subject);
};
