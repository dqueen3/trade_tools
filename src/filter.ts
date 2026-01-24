import fs from "fs";
import path from "path";

const loadList = (filePath: string): string[] => {
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const configDir = path.resolve(process.cwd(), "config");

export const rules = {
  include: loadList(path.join(configDir, "include.txt")),
  exclude: loadList(path.join(configDir, "exclude.txt")),
};

export type FilterResult = {
  matched: boolean;
  matchedKeywords: string[];
  excludedKeywords: string[];
};

const normalize = (value: string): string => value.toLowerCase();

export const evaluateText = (text: string): FilterResult => {
  const normalizedText = normalize(text);
  const matchedKeywords = rules.include.filter((keyword) =>
    normalizedText.includes(normalize(keyword)),
  );
  const excludedKeywords = rules.exclude.filter((keyword) =>
    normalizedText.includes(normalize(keyword)),
  );
  const matched = matchedKeywords.length > 0 && excludedKeywords.length === 0;

  return { matched, matchedKeywords, excludedKeywords };
};
