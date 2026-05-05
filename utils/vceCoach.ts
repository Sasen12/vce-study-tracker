import type {
  Gamification,
  Goal,
  SavedQuestion,
  StudyEvent,
  StudyNote,
  StudyResource,
  StudySession,
  UserSubject
} from "@/types";
import { VCE_SUBJECTS } from "@/constants/vceSubjects";

export const mistakeTag = "mistake-log";
export const flashcardTag = "flashcard";
export const sacPanicTag = "sac-panic-plan";
export const coachAnswerTag = "coach-answer";

export type MistakeNoteDraft = {
  question: string;
  studentAnswer: string;
  issue: string;
  correctIdea: string;
  nextRule: string;
  topic?: string | null;
  commandTerm?: string | null;
};

export type ParsedMistake = MistakeNoteDraft & {
  id: string;
  title: string;
  subjectName?: string | null;
  createdAt: string;
};

export type FlashcardDraft = {
  front: string;
  back: string;
  sourceTitle: string;
  cardType: "normal" | "mistake" | "command" | "blurt";
};

export type ParsedFlashcard = FlashcardDraft & {
  id: string;
  title: string;
  subjectName?: string | null;
  createdAt: string;
};

export type WeaknessSummary = {
  title: string;
  body: string;
  weakSubject?: UserSubject | null;
  weakTopic?: string | null;
  repeatedMistake?: string | null;
  nextAction: string;
};

export type WeeklyReport = {
  totalMinutes: number;
  strongestSubject: string;
  ignoredSubject?: string | null;
  questionCount: number;
  mistakeCount: number;
  streak: number;
  nextMove: string;
  lines: string[];
};

export type SacPanicPlan = {
  title: string;
  daysUntil: number;
  reviseToday: string[];
  practice: string[];
  commonMistakes: string[];
  checklist: string[];
  summaryNotes: string[];
  body: string;
};

export type StudySearchResult = {
  id: string;
  type: "Note" | "Question" | "Event" | "File" | "Mistake" | "Flashcard" | "Coach";
  title: string;
  detail: string;
  route: "/(tabs)/study" | "/(tabs)/questions" | "/(tabs)/calendar";
};

export type CommandTermPrompt = {
  term: string;
  subjectHint: string;
  studentJob: string;
  answerFormula: string;
  markTrap: string;
  weakAnswer: string;
  prompt: string;
  practiceQuestion: string;
  modelAnswer: string;
  criteria: string[];
};

const humanitiesCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Define",
    subjectHint: "Most VCE subjects",
    studentJob: "Give the exact meaning of the term. Keep it tight; do not explain effects yet.",
    answerFormula: "Term + category + key feature or measurable detail.",
    markTrap: "Writing a vague everyday meaning instead of a precise VCE definition.",
    weakAnswer: "Market share is how much of the market a business has.",
    prompt: "Rewrite the weak answer as a precise definition.",
    practiceQuestion: "Define market share.",
    modelAnswer: "Market share is the percentage of total sales in a market held by one business over a specific period.",
    criteria: ["Precise meaning", "Uses measurable language", "Avoids extra explanation"]
  },
  {
    term: "Describe",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Say what it is like. Give features, characteristics or observable details.",
    answerFormula: "Name the idea + give 2-3 clear features.",
    markTrap: "Explaining why it matters when the question only asks what it is like.",
    weakAnswer: "Motivation makes employees work harder.",
    prompt: "Rewrite the weak answer so it describes the idea clearly.",
    practiceQuestion: "Describe employee motivation.",
    modelAnswer: "Motivation is the internal or external drive that encourages employees to put effort into work tasks and persist toward business objectives.",
    criteria: ["Gives characteristics", "Mentions effort or persistence", "Links to the context"]
  },
  {
    term: "Explain",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Show why or how something happens. The marker wants cause and effect.",
    answerFormula: "Point + because/which means/therefore + outcome.",
    markTrap: "Listing a fact without showing the chain of reasoning.",
    weakAnswer: "Training is good because employees learn new skills.",
    prompt: "Rewrite the weak answer with a clear cause-and-effect chain.",
    practiceQuestion: "Explain how training can improve business performance.",
    modelAnswer: "Training improves employee skills and knowledge, which can reduce errors and increase productivity because employees complete tasks more efficiently.",
    criteria: ["Uses because/therefore logic", "Shows cause and effect", "Links to an outcome"]
  },
  {
    term: "Analyse",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Break the idea into parts and show how those parts connect to the result.",
    answerFormula: "Idea + mechanism + evidence/detail + link back to the question.",
    markTrap: "Only saying something is good or bad without unpacking how it works.",
    weakAnswer: "This strategy helps because it improves productivity.",
    prompt: "Rewrite the weak answer so it breaks down how the strategy works.",
    practiceQuestion: "Analyse how a strategy can improve business efficiency.",
    modelAnswer: "This strategy can improve productivity by reducing wasted time in the production process. Higher productivity lowers unit costs, helping the business meet its objective of improving efficiency.",
    criteria: ["Breaks down how it works", "Uses evidence or a mechanism", "Links back to the objective"]
  },
  {
    term: "Evaluate",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Weigh strengths and weaknesses, then make a judgement.",
    answerFormula: "Strength + limitation + context + overall judgement.",
    markTrap: "Giving two sides but never deciding which side is stronger.",
    weakAnswer: "This method is effective but has some disadvantages.",
    prompt: "Rewrite the weak answer so it weighs both sides and decides.",
    practiceQuestion: "Evaluate the effectiveness of a management strategy.",
    modelAnswer: "This method is effective in the short term because it gives clear direction, but it may reduce employee input and motivation. Overall, it is most suitable during urgent change rather than long-term improvement.",
    criteria: ["Gives both sides", "Makes a judgement", "Uses context to decide"]
  },
  {
    term: "Justify",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Make a choice and prove why that choice is reasonable.",
    answerFormula: "Decision + evidence/reason + link to criteria, objective or user need.",
    markTrap: "Saying 'it is better' without evidence or a criterion.",
    weakAnswer: "I would choose this design because it is better.",
    prompt: "Rewrite the weak answer so the decision is properly defended.",
    practiceQuestion: "Justify a design choice for a user scenario.",
    modelAnswer: "I would choose this design because it directly addresses the user's need for faster data entry while reducing validation errors through constrained input fields.",
    criteria: ["States a decision", "Gives evidence", "Links to criteria or user need"]
  },
  {
    term: "Compare",
    subjectHint: "Humanities, Business, Health/PE",
    studentJob: "Show similarities and/or differences between two things.",
    answerFormula: "Both items named + comparative word + specific similarity/difference + effect.",
    markTrap: "Describing each thing separately without directly comparing them.",
    weakAnswer: "The two methods are different because one is faster.",
    prompt: "Rewrite the weak answer so both sides are directly compared.",
    practiceQuestion: "Compare two methods or approaches.",
    modelAnswer: "Method A is faster because it requires fewer steps, whereas Method B is slower but produces more detailed evidence for checking the result.",
    criteria: ["Names both sides", "Uses comparative language", "Explains the basis of comparison"]
  }
];

const mathsCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Calculate",
    subjectHint: "Mathematics",
    studentJob: "Use a mathematical process to get a numerical answer. Show enough working for method marks.",
    answerFormula: "Substitute/setup + working + final answer + units or rounding if needed.",
    markTrap: "Only writing the final number with no working, units, or context.",
    weakAnswer: "The gradient is 3.",
    prompt: "Improve this by showing the method and final answer clearly.",
    practiceQuestion: "Calculate the gradient between (2, 5) and (6, 17).",
    modelAnswer: "Gradient = (17 - 5) / (6 - 2) = 12 / 4 = 3, so the gradient is 3.",
    criteria: ["Correct setup", "Clear working", "Final answer stated"]
  },
  {
    term: "Determine",
    subjectHint: "Mathematics",
    studentJob: "Find the required value using the information given. Choose a suitable method and show the result.",
    answerFormula: "Relevant rule/method + substitution or reasoning + required value.",
    markTrap: "Jumping to an answer without showing how the value was found.",
    weakAnswer: "The median is 24.",
    prompt: "Improve this by showing how the value was determined.",
    practiceQuestion: "Determine the median of 12, 18, 24, 30 and 42.",
    modelAnswer: "The values are already ordered. The middle value is 24, so the median is 24.",
    criteria: ["Uses the given data", "Shows method", "States the required value"]
  },
  {
    term: "Solve",
    subjectHint: "Mathematics",
    studentJob: "Find the value or values that make an equation or condition true.",
    answerFormula: "Equation + algebra/technology steps + solution set + restrictions if needed.",
    markTrap: "Giving one value when there may be more, or not checking restrictions.",
    weakAnswer: "x = 4.",
    prompt: "Improve this by showing the equation steps.",
    practiceQuestion: "Solve 3x + 5 = 17.",
    modelAnswer: "3x + 5 = 17, so 3x = 12 and x = 4.",
    criteria: ["Correct algebra", "Clear solution", "Checks the requested value"]
  },
  {
    term: "Show that",
    subjectHint: "Mathematics",
    studentJob: "Prove the given result from the information. The answer is already known, so the working matters.",
    answerFormula: "Start from given information + valid working + arrive at the stated result.",
    markTrap: "Restating the result without proving it.",
    weakAnswer: "It equals 20, so it is shown.",
    prompt: "Improve this by proving the result instead of just stating it.",
    practiceQuestion: "Show that 4(3 + 2) = 20.",
    modelAnswer: "4(3 + 2) = 4 x 5 = 20, so the expression is equal to 20.",
    criteria: ["Starts with the given expression", "Uses valid steps", "Arrives at the stated result"]
  },
  {
    term: "Interpret",
    subjectHint: "Mathematics",
    studentJob: "Explain what a value, graph feature, statistic, or result means in the context.",
    answerFormula: "Mathematical result + plain-language meaning + context/units.",
    markTrap: "Repeating the number without saying what it means.",
    weakAnswer: "The gradient is positive.",
    prompt: "Improve this by explaining the meaning in context.",
    practiceQuestion: "Interpret a positive gradient on a distance-time graph.",
    modelAnswer: "A positive gradient means the distance from the starting point is increasing over time, so the object is moving away from the start.",
    criteria: ["Uses the mathematical feature", "Explains meaning", "Links to context"]
  },
  {
    term: "Justify",
    subjectHint: "Mathematics",
    studentJob: "Give a mathematical reason for a choice, conclusion, or statement.",
    answerFormula: "Conclusion + calculation/property/evidence + why it supports the conclusion.",
    markTrap: "Saying an answer is correct without mathematical evidence.",
    weakAnswer: "This model is better because it is closer.",
    prompt: "Improve this with mathematical evidence.",
    practiceQuestion: "Justify which model better fits a data set.",
    modelAnswer: "Model A is better because its residuals are smaller and more randomly scattered, so its predictions are closer to the observed data with less systematic error.",
    criteria: ["States a conclusion", "Uses mathematical evidence", "Explains why the evidence supports it"]
  }
];

const scienceCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Define",
    subjectHint: "Sciences",
    studentJob: "Give the exact scientific meaning of a term.",
    answerFormula: "Term + scientific category + key feature.",
    markTrap: "Using everyday wording instead of scientific wording.",
    weakAnswer: "Homeostasis is when the body stays normal.",
    prompt: "Improve this into a precise scientific definition.",
    practiceQuestion: "Define homeostasis.",
    modelAnswer: "Homeostasis is the regulation of internal conditions within narrow limits despite changes in the external environment.",
    criteria: ["Scientific wording", "Key feature included", "Concise definition"]
  },
  {
    term: "Explain",
    subjectHint: "Sciences",
    studentJob: "Show the cause, process, or reason behind a result.",
    answerFormula: "Cause/process + because/therefore + scientific outcome.",
    markTrap: "Naming the process but not explaining how it causes the outcome.",
    weakAnswer: "Enzymes work faster when it is warm.",
    prompt: "Improve this by showing the process.",
    practiceQuestion: "Explain why enzyme activity increases as temperature rises up to an optimum.",
    modelAnswer: "As temperature rises, enzyme and substrate particles have more kinetic energy, so successful collisions occur more often until the optimum temperature is reached.",
    criteria: ["Uses science concepts", "Shows cause and effect", "Links to outcome"]
  },
  {
    term: "Compare",
    subjectHint: "Sciences",
    studentJob: "State similarities and/or differences using both items.",
    answerFormula: "Item A + comparative word + item B + specific feature.",
    markTrap: "Describing two things separately without direct comparison.",
    weakAnswer: "Mitosis has two cells and meiosis has four.",
    prompt: "Improve this by directly comparing the processes.",
    practiceQuestion: "Compare mitosis and meiosis.",
    modelAnswer: "Mitosis produces two genetically identical diploid cells, whereas meiosis produces four genetically different haploid cells.",
    criteria: ["Names both items", "Uses comparative language", "Specific similarity or difference"]
  },
  {
    term: "Analyse",
    subjectHint: "Sciences",
    studentJob: "Break data, evidence, or a process into parts and explain the relationship.",
    answerFormula: "Pattern/part + evidence + scientific link + conclusion.",
    markTrap: "Stating a trend without using data or scientific reasoning.",
    weakAnswer: "The rate goes up because concentration is higher.",
    prompt: "Improve this by unpacking the relationship.",
    practiceQuestion: "Analyse how concentration affects reaction rate.",
    modelAnswer: "As concentration increases, particles are closer together, causing more frequent successful collisions per second and therefore a higher reaction rate.",
    criteria: ["Identifies relationship", "Uses evidence or mechanism", "Draws conclusion"]
  },
  {
    term: "Evaluate",
    subjectHint: "Sciences",
    studentJob: "Judge the quality, reliability, or usefulness of evidence or a method.",
    answerFormula: "Strength + limitation + effect on validity/reliability + judgement.",
    markTrap: "Listing pros and cons without deciding how trustworthy the evidence is.",
    weakAnswer: "The experiment is good but has errors.",
    prompt: "Improve this by judging the method or evidence.",
    practiceQuestion: "Evaluate the reliability of an experiment.",
    modelAnswer: "The experiment is reasonably reliable because repeated trials produced similar results, but the small sample size limits confidence in applying the conclusion broadly.",
    criteria: ["Uses evidence quality", "Mentions limitation", "Makes judgement"]
  },
  {
    term: "Interpret",
    subjectHint: "Sciences",
    studentJob: "State what data, a graph, or an observation means scientifically.",
    answerFormula: "Data feature + scientific meaning + context.",
    markTrap: "Reading the graph value but not explaining what it means.",
    weakAnswer: "The line goes down.",
    prompt: "Improve this by explaining the scientific meaning.",
    practiceQuestion: "Interpret a decreasing line on a concentration-time graph.",
    modelAnswer: "The decreasing line shows that reactant concentration is falling over time as reactant particles are being used up in the reaction.",
    criteria: ["Reads the data feature", "Explains meaning", "Uses context"]
  }
];

const englishCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Analyse",
    subjectHint: "English and Literature",
    studentJob: "Break down how language, structure, evidence, or author choices create meaning.",
    answerFormula: "Author choice + evidence + effect on reader/meaning + link to argument.",
    markTrap: "Naming a technique without explaining its effect.",
    weakAnswer: "The author uses imagery to show sadness.",
    prompt: "Improve this by explaining how the technique creates meaning.",
    practiceQuestion: "Analyse how imagery creates meaning in a text.",
    modelAnswer: "The image of the empty street suggests isolation, positioning the reader to see the character's grief as private and unresolved.",
    criteria: ["Identifies author choice", "Explains effect", "Links to interpretation"]
  },
  {
    term: "Compare",
    subjectHint: "English and Literature",
    studentJob: "Show similarities and/or differences between texts, characters, arguments, or ideas.",
    answerFormula: "Text A + comparative word + Text B + meaning/effect.",
    markTrap: "Writing two separate mini paragraphs without a direct comparison.",
    weakAnswer: "Both texts are about family but they are different.",
    prompt: "Improve this by comparing the ideas directly.",
    practiceQuestion: "Compare how two texts present family responsibility.",
    modelAnswer: "While both texts present family responsibility as demanding, Text A frames it as a source of identity, whereas Text B presents it as a burden that restricts personal freedom.",
    criteria: ["Direct comparison", "Mentions both texts", "Explains meaning"]
  },
  {
    term: "Discuss",
    subjectHint: "English and Literature",
    studentJob: "Explore an idea from more than one angle before developing a position.",
    answerFormula: "Idea + angle one + angle two/complication + considered position.",
    markTrap: "Only agreeing with the prompt without exploring complexity.",
    weakAnswer: "The character is responsible for what happened.",
    prompt: "Improve this by showing complexity.",
    practiceQuestion: "Discuss whether a character is responsible for the outcome.",
    modelAnswer: "The character contributes to the outcome through repeated silence, but the text also suggests that social pressure limits their ability to act freely.",
    criteria: ["Explores more than one angle", "Uses text logic", "Builds a position"]
  },
  {
    term: "Evaluate",
    subjectHint: "English and Literature",
    studentJob: "Make a judgement about effectiveness, significance, or extent.",
    answerFormula: "Judgement + evidence + why it matters + qualification if needed.",
    markTrap: "Saying something is effective without explaining why.",
    weakAnswer: "The ending is effective because it is emotional.",
    prompt: "Improve this with a judgement and evidence.",
    practiceQuestion: "Evaluate the effectiveness of an ending.",
    modelAnswer: "The ending is effective because its unresolved image forces readers to sit with the consequences of the conflict rather than offering simple closure.",
    criteria: ["Clear judgement", "Textual evidence", "Explains significance"]
  },
  {
    term: "Interpret",
    subjectHint: "English and Literature",
    studentJob: "Explain your reading of meaning, implication, or significance.",
    answerFormula: "Reading/interpretation + evidence + why that reading makes sense.",
    markTrap: "Retelling plot instead of explaining meaning.",
    weakAnswer: "This scene means the character is upset.",
    prompt: "Improve this into a richer interpretation.",
    practiceQuestion: "Interpret a scene where a character refuses to speak.",
    modelAnswer: "The character's refusal to speak can be read as resistance, because silence becomes the only control they have in a conversation dominated by others.",
    criteria: ["Gives interpretation", "Uses evidence", "Explains significance"]
  }
];

const technologyCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Describe",
    subjectHint: "Technology",
    studentJob: "Give the relevant features of a system, design, data set, or process.",
    answerFormula: "Feature + purpose + relevant detail.",
    markTrap: "Naming the feature without saying what it does.",
    weakAnswer: "Validation checks the data.",
    prompt: "Improve this by describing the feature clearly.",
    practiceQuestion: "Describe a validation technique.",
    modelAnswer: "A range check is a validation technique that ensures entered data falls between accepted minimum and maximum values before it is stored.",
    criteria: ["Names feature", "Gives purpose", "Includes relevant detail"]
  },
  {
    term: "Explain",
    subjectHint: "Technology",
    studentJob: "Show how or why a design decision, process, or security control works.",
    answerFormula: "Decision/control + mechanism + impact on user, data, or system.",
    markTrap: "Listing a benefit without explaining the mechanism.",
    weakAnswer: "Encryption is good because it is safer.",
    prompt: "Improve this by explaining how it helps.",
    practiceQuestion: "Explain how encryption protects data.",
    modelAnswer: "Encryption converts readable data into unreadable ciphertext, so unauthorised users cannot understand the data without the correct key.",
    criteria: ["Explains mechanism", "Links to impact", "Uses technical terms correctly"]
  },
  {
    term: "Justify",
    subjectHint: "Technology",
    studentJob: "Defend a design or technical choice using criteria, evidence, or user needs.",
    answerFormula: "Choice + criterion/user need + evidence + why it fits.",
    markTrap: "Saying a choice is better without linking to the scenario.",
    weakAnswer: "I would use a drop-down because it is easier.",
    prompt: "Improve this by linking the choice to a user or data need.",
    practiceQuestion: "Justify using a drop-down list in an input form.",
    modelAnswer: "A drop-down list is suitable because it limits input to valid options, reducing data-entry errors for users and improving data consistency.",
    criteria: ["States choice", "Links to criteria", "Uses scenario evidence"]
  },
  {
    term: "Evaluate",
    subjectHint: "Technology",
    studentJob: "Judge how well a solution, method, or design meets criteria.",
    answerFormula: "Strength + weakness + criterion + final judgement.",
    markTrap: "Listing features without deciding whether the solution meets the need.",
    weakAnswer: "The design is good but could be improved.",
    prompt: "Improve this by judging against criteria.",
    practiceQuestion: "Evaluate a solution against usability.",
    modelAnswer: "The solution is mostly usable because navigation is consistent and labels are clear, but small button spacing may reduce accuracy on mobile devices.",
    criteria: ["Uses criteria", "Gives strength and limitation", "Makes judgement"]
  },
  {
    term: "Analyse",
    subjectHint: "Technology",
    studentJob: "Break down a scenario, data flow, algorithm, or design decision and show relationships.",
    answerFormula: "Component + role + relationship/effect + conclusion.",
    markTrap: "Describing parts without explaining how they interact.",
    weakAnswer: "The database stores the customer data.",
    prompt: "Improve this by explaining the relationship in the system.",
    practiceQuestion: "Analyse how a database supports an online booking system.",
    modelAnswer: "The database stores customer, booking, and availability data so the interface can check times in real time and prevent double bookings.",
    criteria: ["Identifies components", "Explains relationships", "Links to system outcome"]
  }
];

const artsCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Describe",
    subjectHint: "The Arts",
    studentJob: "Give visible, audible, or design features using subject-specific language.",
    answerFormula: "Feature + subject term + detail.",
    markTrap: "Writing personal opinion instead of observable features.",
    weakAnswer: "The artwork looks bright and nice.",
    prompt: "Improve this with specific visual language.",
    practiceQuestion: "Describe the use of colour in an artwork.",
    modelAnswer: "The artwork uses saturated warm colours, especially red and orange, to create a strong focal point in the centre of the composition.",
    criteria: ["Uses subject language", "Specific feature", "Clear detail"]
  },
  {
    term: "Analyse",
    subjectHint: "The Arts",
    studentJob: "Break down how elements, principles, techniques, or choices create meaning/effect.",
    answerFormula: "Element/choice + technique + effect + meaning.",
    markTrap: "Naming an element without explaining its effect.",
    weakAnswer: "The artist uses line to make it interesting.",
    prompt: "Improve this by explaining how the element works.",
    practiceQuestion: "Analyse how line creates movement.",
    modelAnswer: "The repeated diagonal lines guide the viewer's eye upward, creating a sense of movement and tension across the composition.",
    criteria: ["Identifies choice", "Explains effect", "Links to meaning"]
  },
  {
    term: "Evaluate",
    subjectHint: "The Arts",
    studentJob: "Judge how effectively a work, performance, or design achieves an intention.",
    answerFormula: "Judgement + evidence + intention/criteria + limitation if relevant.",
    markTrap: "Saying you like it without judging effectiveness.",
    weakAnswer: "The performance was effective because it was emotional.",
    prompt: "Improve this with evidence and judgement.",
    practiceQuestion: "Evaluate how effectively a performance communicates tension.",
    modelAnswer: "The performance communicates tension effectively because the slow pacing, restricted movement, and silence create suspense before the final confrontation.",
    criteria: ["Makes judgement", "Uses evidence", "Links to intention"]
  }
];

const vmVetCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Identify",
    subjectHint: "VCE VM and VET",
    studentJob: "Name the correct item, issue, skill, factor, or example.",
    answerFormula: "Clear item named + relevant context if needed.",
    markTrap: "Explaining around the answer but never naming it clearly.",
    weakAnswer: "It is about safety.",
    prompt: "Improve this by naming the specific item.",
    practiceQuestion: "Identify one workplace hazard.",
    modelAnswer: "One workplace hazard is an exposed electrical cord across a walkway.",
    criteria: ["Names the item", "Specific", "Relevant to context"]
  },
  {
    term: "Describe",
    subjectHint: "VCE VM and VET",
    studentJob: "Give key features or details of a skill, process, workplace issue, or example.",
    answerFormula: "Item + features + relevant workplace/community detail.",
    markTrap: "Giving a one-word answer when detail is required.",
    weakAnswer: "Teamwork is helping people.",
    prompt: "Improve this with practical details.",
    practiceQuestion: "Describe teamwork in a workplace.",
    modelAnswer: "Teamwork involves communicating clearly, sharing tasks, and supporting others so the group can complete work safely and efficiently.",
    criteria: ["Gives features", "Practical context", "Clear detail"]
  },
  {
    term: "Explain",
    subjectHint: "VCE VM and VET",
    studentJob: "Show why something matters or how it leads to an outcome.",
    answerFormula: "Point + because + workplace/community outcome.",
    markTrap: "Saying something is important without explaining why.",
    weakAnswer: "Communication is important at work.",
    prompt: "Improve this by showing why.",
    practiceQuestion: "Explain why clear communication matters in the workplace.",
    modelAnswer: "Clear communication matters because it helps workers understand tasks and safety expectations, reducing mistakes and improving teamwork.",
    criteria: ["Shows reason", "Links to outcome", "Uses context"]
  },
  {
    term: "Apply",
    subjectHint: "VCE VM and VET",
    studentJob: "Use knowledge or a skill in a practical scenario.",
    answerFormula: "Scenario detail + relevant skill/knowledge + action.",
    markTrap: "Giving a general definition instead of using the scenario.",
    weakAnswer: "I would be safe.",
    prompt: "Improve this by applying the idea to the scenario.",
    practiceQuestion: "Apply a safety procedure to a workplace scenario.",
    modelAnswer: "I would move the exposed cord away from the walkway, report it to a supervisor, and use signage until the hazard is fixed.",
    criteria: ["Uses scenario", "Gives practical action", "Relevant skill or knowledge"]
  }
];

const languageCommandTermPrompts: CommandTermPrompt[] = [
  {
    term: "Identify",
    subjectHint: "Languages",
    studentJob: "Find a specific detail, idea, audience, purpose, or language feature.",
    answerFormula: "Specific detail + where relevant, evidence from the text.",
    markTrap: "Giving a broad topic instead of the exact detail asked for.",
    weakAnswer: "The text is about travel.",
    prompt: "Improve this by identifying the specific detail.",
    practiceQuestion: "Identify the speaker's main reason for travelling.",
    modelAnswer: "The speaker is travelling to visit relatives during the school holidays.",
    criteria: ["Specific detail", "Relevant to question", "Text-based"]
  },
  {
    term: "Explain",
    subjectHint: "Languages",
    studentJob: "Show meaning, purpose, or reason using evidence from the text.",
    answerFormula: "Meaning/reason + evidence/detail + link to purpose.",
    markTrap: "Translating a phrase without explaining its purpose.",
    weakAnswer: "The phrase means it is important.",
    prompt: "Improve this by explaining meaning and purpose.",
    practiceQuestion: "Explain why the writer uses a polite expression.",
    modelAnswer: "The polite expression shows respect for the audience and makes the request sound less direct.",
    criteria: ["Explains meaning", "Uses evidence", "Links to purpose"]
  },
  {
    term: "Compare",
    subjectHint: "Languages",
    studentJob: "Show similarities or differences in views, customs, language choices, or details.",
    answerFormula: "Item A + comparative language + item B + evidence.",
    markTrap: "Describing both sides separately without a direct comparison.",
    weakAnswer: "They have different opinions.",
    prompt: "Improve this by directly comparing the views.",
    practiceQuestion: "Compare two speakers' opinions about school.",
    modelAnswer: "Speaker A sees school as stressful because of exams, whereas Speaker B focuses on friendship and support.",
    criteria: ["Compares directly", "Uses both sides", "Includes evidence"]
  }
];

export const commandTermPrompts = humanitiesCommandTermPrompts;

export const commandTermsForSubject = (subjectName?: string | null): CommandTermPrompt[] => {
  const subject = VCE_SUBJECTS.find((item) => item.name.toLowerCase() === subjectName?.trim().toLowerCase());
  switch (subject?.category) {
    case "Mathematics":
      return mathsCommandTermPrompts;
    case "Sciences":
      return scienceCommandTermPrompts;
    case "English":
      return englishCommandTermPrompts;
    case "Technology":
      return technologyCommandTermPrompts;
    case "The Arts":
      return artsCommandTermPrompts;
    case "Languages":
      return languageCommandTermPrompts;
    case "VCE VM":
    case "VCE VET":
      return vmVetCommandTermPrompts;
    case "Health and PE":
    case "Humanities":
    default:
      return humanitiesCommandTermPrompts;
  }
};

const normalise = (value?: string | null) => value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";

const dateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const weekStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isBetween = (value: string | Date, start: Date, end: Date) => {
  const date = new Date(value);
  return date >= start && date < end;
};

const sectionValue = (body: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Z][^\\n:]{1,48}:|$)`, "i").exec(body);
  return match?.[1]?.trim() ?? "";
};

const oneLine = (value: string, fallback = "Not recorded") => value.replace(/\s+/g, " ").trim() || fallback;

export const hasTag = (note: StudyNote, tag: string) => note.tags?.includes(tag);

export const isMistakeNote = (note: StudyNote) => hasTag(note, mistakeTag) || note.noteType === "mistake_log";

export const isFlashcardNote = (note: StudyNote) => hasTag(note, flashcardTag);

export const isSacPanicNote = (note: StudyNote) => hasTag(note, sacPanicTag);

export const formatMistakeNoteBody = (draft: MistakeNoteDraft) =>
  [
    `Topic:\n${draft.topic?.trim() || "General"}`,
    `Command term:\n${draft.commandTerm?.trim() || "Not sure"}`,
    `Question:\n${draft.question.trim()}`,
    `What I wrote:\n${draft.studentAnswer.trim() || "Not recorded"}`,
    `What went wrong:\n${draft.issue.trim() || "The answer needs a clearer link to the marking criteria."}`,
    `Correct idea:\n${draft.correctIdea.trim() || "Use the model answer and marking criteria to rebuild this."}`,
    `How to avoid this next time:\n${draft.nextRule.trim() || "State the command-term job, then link each point back to the question."}`
  ].join("\n\n");

export const parseMistakeNote = (note: StudyNote): ParsedMistake => ({
  id: note.id,
  title: note.title,
  subjectName: note.subject?.subjectName,
  createdAt: note.createdAt,
  topic: sectionValue(note.body, "Topic") || note.title.replace(/^Mistake:\s*/i, ""),
  commandTerm: sectionValue(note.body, "Command term"),
  question: sectionValue(note.body, "Question") || note.title,
  studentAnswer: sectionValue(note.body, "What I wrote"),
  issue: sectionValue(note.body, "What went wrong") || sectionValue(note.body, "Fix for the roadmap"),
  correctIdea: sectionValue(note.body, "Correct idea") || sectionValue(note.body, "Model answer"),
  nextRule: sectionValue(note.body, "How to avoid this next time") || "Redo this as a fresh answer, then mark against the criteria."
});

export const formatFlashcardNoteBody = (card: FlashcardDraft) =>
  [
    `Type:\n${card.cardType}`,
    `Source:\n${card.sourceTitle}`,
    `Front:\n${card.front.trim()}`,
    `Back:\n${card.back.trim()}`
  ].join("\n\n");

export const parseFlashcardNote = (note: StudyNote): ParsedFlashcard => ({
  id: note.id,
  title: note.title,
  subjectName: note.subject?.subjectName,
  createdAt: note.createdAt,
  cardType: (sectionValue(note.body, "Type") as ParsedFlashcard["cardType"]) || "normal",
  sourceTitle: sectionValue(note.body, "Source") || note.title,
  front: sectionValue(note.body, "Front") || note.title,
  back: sectionValue(note.body, "Back") || note.body
});

export const flashcardsFromNote = (note: StudyNote, limit = 4): FlashcardDraft[] => {
  if (isFlashcardNote(note)) return [];
  if (isMistakeNote(note)) {
    const mistake = parseMistakeNote(note);
    return [
      {
        cardType: "mistake",
        sourceTitle: note.title,
        front: `What is the fix for this mistake? ${oneLine(mistake.question).slice(0, 140)}`,
        back: `${oneLine(mistake.correctIdea)}\n\nNext-time rule: ${oneLine(mistake.nextRule)}`,
      },
      {
        cardType: "command",
        sourceTitle: note.title,
        front: `What command-term habit would stop this happening again?`,
        back: oneLine(mistake.nextRule)
      }
    ];
  }

  const cleanBody = note.body
    .replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 35 && !line.startsWith("#"))
    .slice(0, limit);

  return cleanBody.map((line, index) => ({
    cardType: index % 2 === 0 ? "normal" : "blurt",
    sourceTitle: note.title,
    front: index % 2 === 0 ? `Explain this idea from ${note.title}: ${line.slice(0, 80)}...` : `Blurt everything you remember about: ${note.title}`,
    back: line
  }));
};

export const buildWeaknessSummary = ({
  subjects,
  sessions,
  goals,
  notes,
  savedQuestions,
  events
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  goals: Goal[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  events: StudyEvent[];
}): WeaknessSummary => {
  const start = weekStart();
  const subjectScores = subjects.map((subject) => {
    const weekMinutes =
      sessions
        .filter((session) => session.subjectId === subject.id && new Date(session.createdAt) >= start)
        .reduce((sum, session) => sum + session.durationSeconds, 0) / 60;
    const targetMinutes = Number(goals.find((goal) => goal.subjectId === subject.id)?.weeklyHoursTarget ?? 4) * 60;
    const mistakeCount = notes.filter((note) => isMistakeNote(note) && note.subjectId === subject.id).length;
    const savedCount = savedQuestions.filter((question) => question.subjectId === subject.id).length;
    return {
      subject,
      weekMinutes,
      targetMinutes,
      score: targetMinutes ? weekMinutes / targetMinutes - mistakeCount * 0.08 - (savedCount ? 0 : 0.05) : 1 - mistakeCount * 0.08
    };
  });

  const weak = subjectScores.sort((a, b) => a.score - b.score)[0];
  const mistakeTopics = notes
    .filter(isMistakeNote)
    .map(parseMistakeNote)
    .filter((mistake) => !weak?.subject || normalise(mistake.subjectName) === normalise(weak.subject.subjectName));
  const topicCounts = new Map<string, number>();
  mistakeTopics.forEach((mistake) => {
    const key = oneLine(mistake.topic ?? "General");
    topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
  });
  const weakTopic = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const urgent = events
    .filter((event) => !event.completed && event.subjectId === weak?.subject.id)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  const repeatedMistake = mistakeTopics[0]?.issue ? oneLine(mistakeTopics[0].issue).slice(0, 180) : null;
  const subjectName = weak?.subject.subjectName ?? "your weakest subject";

  return {
    title: weak ? `${subjectName} needs the next repair` : "Weakness Coach is ready",
    body: repeatedMistake
      ? `Pattern spotted: ${repeatedMistake}`
      : weakTopic
        ? `${weakTopic} has the most mistake evidence right now.`
        : urgent
          ? `${urgent.title} is the nearest pressure point for ${subjectName}.`
          : "Create one mistake log or checked answer and this gets sharper.",
    weakSubject: weak?.subject ?? null,
    weakTopic,
    repeatedMistake,
    nextAction: weakTopic
      ? `Do one ${weakTopic} question, mark it, then save the correction.`
      : weak
        ? `Start a focused block for ${subjectName}.`
        : "Generate a question and check the answer."
  };
};

export const buildWeeklyReport = ({
  subjects,
  sessions,
  goals,
  notes,
  savedQuestions,
  gamification
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  goals: Goal[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  gamification?: Gamification | null;
}): WeeklyReport => {
  const start = weekStart();
  const end = addDays(start, 7);
  const weeklySessions = sessions.filter((session) => isBetween(session.createdAt, start, end));
  const totalMinutes = Math.round(weeklySessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
  const minutesBySubject = subjects.map((subject) => ({
    subject,
    minutes: Math.round(
      weeklySessions
        .filter((session) => session.subjectId === subject.id)
        .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
    )
  }));
  const strongest = [...minutesBySubject].sort((a, b) => b.minutes - a.minutes)[0];
  const ignored = minutesBySubject.find((item) => item.minutes === 0 && Number(goals.find((goal) => goal.subjectId === item.subject.id)?.weeklyHoursTarget ?? 0) > 0);
  const questionCount = savedQuestions.filter((question) => new Date(question.createdAt) >= start).length;
  const mistakeCount = notes.filter((note) => isMistakeNote(note) && new Date(note.createdAt) >= start).length;
  const strongestSubject = strongest?.minutes ? strongest.subject.subjectName : "No clear strongest yet";
  const nextMove = ignored
    ? `Give ${ignored.subject.subjectName} one small session before it drifts further.`
    : mistakeCount
      ? "Review this week's mistake cards before starting new content."
      : questionCount
        ? "Turn one saved question into a marked answer."
        : "Do a short question set so next week's report has accuracy evidence.";

  return {
    totalMinutes,
    strongestSubject,
    ignoredSubject: ignored?.subject.subjectName ?? null,
    questionCount,
    mistakeCount,
    streak: gamification?.currentStreak ?? 0,
    nextMove,
    lines: [
      `You studied ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m this week.`,
      strongest?.minutes ? `Strongest subject: ${strongest.subject.subjectName} with ${strongest.minutes} minutes.` : "No subject has momentum yet.",
      ignored ? `Ignored this week: ${ignored.subject.subjectName}.` : "No goal subject was completely ignored.",
      `${questionCount} saved question${questionCount === 1 ? "" : "s"} and ${mistakeCount} mistake log${mistakeCount === 1 ? "" : "s"} added.`,
      `Streak: ${gamification?.currentStreak ?? 0} day${(gamification?.currentStreak ?? 0) === 1 ? "" : "s"}.`
    ]
  };
};

export const buildSacPanicPlan = ({
  subject,
  topic,
  sacDate,
  notes,
  savedQuestions,
  sessions
}: {
  subject: UserSubject;
  topic: string;
  sacDate: string;
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  sessions: StudySession[];
}): SacPanicPlan => {
  const target = new Date(`${sacDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
  const subjectMistakes = notes.filter((note) => isMistakeNote(note) && note.subjectId === subject.id).map(parseMistakeNote);
  const topicMistakes = subjectMistakes.filter((mistake) => normalise(`${mistake.topic} ${mistake.question}`).includes(normalise(topic)));
  const relevantQuestions = savedQuestions.filter(
    (question) => question.subjectId === subject.id && normalise(`${question.topic} ${question.question}`).includes(normalise(topic))
  );
  const recentMinutes = Math.round(
    sessions
      .filter((session) => session.subjectId === subject.id && new Date(session.createdAt) >= addDays(new Date(), -7))
      .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
  );
  const latestNotes = notes
    .filter((note) => note.subjectId === subject.id && !isFlashcardNote(note))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  const reviseToday =
    daysUntil <= 1
      ? [
          `Make a one-page ${topic} summary from memory first.`,
          "Patch only the gaps you could not remember.",
          "Finish with two timed responses and mark them immediately."
        ]
      : daysUntil <= 3
        ? [
            `Rebuild the core ${topic} ideas today.`,
            "Do one easy check, one medium application, one timed SAC-style response.",
            "Write a 5-line error list before stopping."
          ]
        : [
            `Spend 25 minutes mapping the ${topic} content.`,
            "Use the next session for mixed practice, not rereading.",
            "Keep the final day for correction and summary only."
          ];

  const practice = relevantQuestions.length
    ? relevantQuestions.slice(0, 3).map((question) => question.topic || question.question.slice(0, 80))
    : [`Generate 3 ${topic} questions in Forge.`, "Check one written answer with AI feedback.", "Save any weak answer to Mistake Log."];

  const commonMistakes = topicMistakes.length
    ? topicMistakes.slice(0, 3).map((mistake) => oneLine(mistake.issue))
    : [
        "Answering the topic but missing the command term.",
        "Explaining benefits without linking back to the scenario/objective.",
        "Not marking the response against criteria after writing it."
      ];

  const checklist = [
    "Know the command terms likely to appear.",
    "Have one clean summary sheet.",
    "Redo at least one mistake from the log.",
    "Attempt one timed response.",
    "Write the final 5 things to remember before the SAC."
  ];

  const summaryNotes = latestNotes.length
    ? latestNotes.map((note) => `${note.title}: ${oneLine(note.body).slice(0, 140)}`)
    : [`No ${subject.subjectName} notes yet. Create one summary note for ${topic}.`, `${recentMinutes} minutes logged for ${subject.subjectName} in the last 7 days.`];

  const title = `${subject.subjectName} SAC Panic Plan: ${topic}`;
  const body = [
    `${title}`,
    `SAC date: ${sacDate}`,
    `Days until: ${daysUntil}`,
    "",
    "What to revise today:",
    ...reviseToday.map((item) => `- ${item}`),
    "",
    "Questions to practise:",
    ...practice.map((item) => `- ${item}`),
    "",
    "Common mistakes to avoid:",
    ...commonMistakes.map((item) => `- ${item}`),
    "",
    "Mini checklist:",
    ...checklist.map((item) => `- ${item}`),
    "",
    "Last-minute summary notes:",
    ...summaryNotes.map((item) => `- ${item}`)
  ].join("\n");

  return { title, daysUntil, reviseToday, practice, commonMistakes, checklist, summaryNotes, body };
};

export const globalStudySearch = ({
  query,
  notes,
  savedQuestions,
  events,
  resources
}: {
  query: string;
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  events: StudyEvent[];
  resources: StudyResource[];
}): StudySearchResult[] => {
  const term = normalise(query);
  if (term.length < 2) return [];
  const matches = (value?: string | null) => normalise(value).includes(term);

  return [
    ...notes
      .filter((note) => matches(note.title) || matches(note.body) || matches(note.subject?.subjectName))
      .slice(0, 6)
      .map((note) => ({
        id: note.id,
        type: isFlashcardNote(note) ? "Flashcard" as const : isMistakeNote(note) ? "Mistake" as const : hasTag(note, coachAnswerTag) ? "Coach" as const : "Note" as const,
        title: note.title,
        detail: `${note.subject?.subjectName ?? "General"} - ${dateKey(note.updatedAt)}`,
        route: "/(tabs)/study" as const
      })),
    ...savedQuestions
      .filter((question) => matches(question.question) || matches(question.modelAnswer) || matches(question.topic) || matches(question.subject?.subjectName))
      .slice(0, 5)
      .map((question) => ({
        id: question.id,
        type: "Question" as const,
        title: question.topic || question.question.slice(0, 80),
        detail: `${question.subject?.subjectName ?? "Saved"} - ${question.difficulty ?? "practice"}`,
        route: "/(tabs)/questions" as const
      })),
    ...events
      .filter((event) => matches(event.title) || matches(event.description) || matches(event.subject?.subjectName))
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        type: "Event" as const,
        title: event.title,
        detail: `${event.subject?.subjectName ?? "No subject"} - ${event.eventDate.slice(0, 10)}`,
        route: "/(tabs)/calendar" as const
      })),
    ...resources
      .filter((resource) => matches(resource.fileName) || matches(resource.extractedTextPreview) || matches(resource.subject?.subjectName))
      .slice(0, 5)
      .map((resource) => ({
        id: resource.id,
        type: "File" as const,
        title: resource.fileName,
        detail: `${resource.subject?.subjectName ?? "General"} - ${resource.sourceType}`,
        route: "/(tabs)/study" as const
      }))
  ].slice(0, 12);
};
