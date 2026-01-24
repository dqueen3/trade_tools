export const rules = {
  include: ["生成AI", "LLM", "自動化", "DX"],
  exclude: ["キャンペーン", "無料", "セミナー"],
} as const;

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
