const vicEduAuSuffix = ".vic.edu.au";

const ignoredDomainLabels = new Set([
  "email",
  "learn",
  "mail",
  "portal",
  "school",
  "schools",
  "staff",
  "student",
  "students",
  "www"
]);

const titleCaseWord = (word: string) => (word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word);

const formatSchoolDomainLabel = (label: string) =>
  label
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");

export const isVicEduAuEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain === "vic.edu.au" || domain.endsWith(vicEduAuSuffix);
};

export const inferSchoolNameFromEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain.endsWith(vicEduAuSuffix)) return null;

  const schoolDomain = domain.slice(0, -vicEduAuSuffix.length);
  const labels = schoolDomain.split(".").filter(Boolean);
  const schoolLabel = labels.filter((label) => !ignoredDomainLabels.has(label)).at(-1);
  if (!schoolLabel) return null;

  return formatSchoolDomainLabel(schoolLabel);
};
