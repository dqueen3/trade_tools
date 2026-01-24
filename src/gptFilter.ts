import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const OPENAI_MODEL = "gpt-5-mini";
const SYSTEM_PROMPT = "あなたは企業IRとDX文脈を評価するアナリストです。";

type GptDecision = {
  is_listed: boolean;
  category: "A" | "B" | "C" | "D";
  reason: string;
};

const buildUserPrompt = (title: string, summary: string): string => {
  return `以下のPRは上場企業またはその子会社によるものですか？
また、内容は以下のどれに該当しますか？

A: 実運用・業務導入
B: PoC・実験段階
C: マーケティング・宣伝
D: 情報提供・調査

JSONで出力してください：
{
  "is_listed": true/false,
  "category": "A/B/C/D",
  "reason": "20文字以内"
}

PR本文：
${title}
${summary}
`;
};

const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
};

const parseDecision = (content: string): GptDecision | null => {
  try {
    const parsed = JSON.parse(content) as GptDecision;
    if (
      typeof parsed.is_listed !== "boolean" ||
      !["A", "B", "C", "D"].includes(parsed.category)
    ) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse GPT decision:", error);
    return null;
  }
};

export const passesGptFilter = async (
  title: string,
  summary: string,
): Promise<boolean> => {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, summary) },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  const decision = parseDecision(content);
  if (!decision) {
    return false;
  }
  return decision.is_listed === true && decision.category === "A";
};
