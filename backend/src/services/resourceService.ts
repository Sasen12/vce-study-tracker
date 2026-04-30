import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as typeof import("pdf-parse");
const mammoth = require("mammoth") as {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }>;
};
const WordExtractor = require("word-extractor") as new () => {
  extract: (input: Buffer) => Promise<{
    getBody: () => string;
    getFootnotes?: () => string;
    getEndnotes?: () => string;
    getHeaders?: () => string;
    getFooters?: () => string;
    getAnnotations?: () => string;
    getTextboxes?: () => string;
  }>;
};

const maxStoredChars = 250_000;

const normalizeText = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxStoredChars);

export const detectResourceType = (file: Express.Multer.File) => {
  const name = file.originalname.toLowerCase();
  if (file.mimetype === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (file.mimetype === "application/msword" || name.endsWith(".doc")) return "doc";
  if (name.endsWith(".md") || file.mimetype === "text/markdown") return "markdown";
  return "text";
};

export const extractResourceText = async (file: Express.Multer.File) => {
  const fileType = detectResourceType(file);

  if (fileType === "pdf") {
    const parsed = await pdfParse(file.buffer);
    return {
      fileType,
      text: normalizeText(parsed.text || "")
    };
  }

  if (fileType === "docx") {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      fileType,
      text: normalizeText(parsed.value || "")
    };
  }

  if (fileType === "doc") {
    const extractor = new WordExtractor();
    const parsed = await extractor.extract(file.buffer);
    const parts = [
      parsed.getBody(),
      parsed.getHeaders?.(),
      parsed.getFooters?.(),
      parsed.getFootnotes?.(),
      parsed.getEndnotes?.(),
      parsed.getAnnotations?.(),
      parsed.getTextboxes?.()
    ].filter(Boolean);
    return {
      fileType,
      text: normalizeText(parts.join("\n\n"))
    };
  }

  return {
    fileType,
    text: normalizeText(file.buffer.toString("utf8"))
  };
};

export const contextSnippet = (label: string, text: string, maxChars = 1600) => {
  const cleaned = normalizeText(text);
  if (!cleaned) return "";
  return `### ${label}\n${cleaned.slice(0, maxChars)}`;
};

export const contextSnippetForQuery = (label: string, text: string, query: string, maxChars = 1600) => {
  const cleaned = normalizeText(text);
  if (!cleaned) return "";

  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 3)
    )
  );

  const lowered = cleaned.toLowerCase();
  const firstMatch = terms
    .map((term) => lowered.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstMatch === undefined || cleaned.length <= maxChars) {
    return contextSnippet(label, cleaned, maxChars);
  }

  const start = Math.max(0, firstMatch - 360);
  const excerpt = `${start > 0 ? "... " : ""}${cleaned.slice(start, start + maxChars)}${
    start + maxChars < cleaned.length ? " ..." : ""
  }`;
  return `### ${label}\n${excerpt}`;
};
