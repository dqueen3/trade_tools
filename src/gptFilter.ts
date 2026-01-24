import dotenv from "dotenv";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";

dotenv.config();

const OPENAI_MODEL = "gpt-5-mini";
const API_URL = "https://api.openai.com/v1/responses";

const SYSTEM_PROMPT = "あなたは企業IRとDX文脈を評価するアナリストです。";

const DATA_DIR = path.resolve(__dirname, "..", "data");
const LOG_PATH = path.join(DATA_DIR, "gpt_api.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 3;

export type GptFilterResult = {
  isListed: boolean;
  category: "A" | "B" | "C" | "D";
  reason: string;
  passed: boolean;
  calledAt: string;
};

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

PR本文：
${title}
${summary}
`;
};

const getApiKey = (): string => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return apiKey;
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

const ensureDataDir = async (): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const rotateLogIfNeeded = async (): Promise<void> => {
  try {
    const stat = await fs.stat(LOG_PATH);
    if (stat.size < MAX_LOG_SIZE) {
      return;
    }

    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = `${LOG_PATH}.${i}`;
      const newer = i === 1 ? LOG_PATH : `${LOG_PATH}.${i - 1}`;
      try {
        await fs.rename(newer, older);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
  } catch {
    // ログファイルが存在しない場合は無視
  }
};

const appendLog = async (
  prId: string,
  request: any,
  response: any,
  error?: string,
): Promise<void> => {
  await ensureDataDir();
  await rotateLogIfNeeded();

  const timestamp = new Date().toISOString();
  const lines = [
    `[${timestamp}] PR_ID=${prId}`,
    `REQUEST: ${JSON.stringify(request, null, 2).slice(0, 500)}...`,
  ];

  if (error) {
    lines.push(`ERROR: ${error}`);
  } else {
    lines.push(`RESPONSE: ${JSON.stringify(response, null, 2).slice(0, 500)}...`);
  }
  lines.push("---\n");

  await fs.appendFile(LOG_PATH, lines.join("\n"), "utf8");
};

const buildRequest = (title: string, summary: string) => {
  const userPrompt = buildUserPrompt(title, summary);

  return {
    model: OPENAI_MODEL,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt,
          },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        name: "evaluatePR",
        description: "PRが上場企業のものか、またその内容カテゴリを判定する",
        parameters: {
          type: "object",
          properties: {
            is_listed: {
              type: "boolean",
              description: "上場企業またはその子会社によるPRかどうか",
            },
            category: {
              type: "string",
              enum: ["A", "B", "C", "D"],
              description: "A: 実運用・業務導入, B: PoC・実験段階, C: マーケティング・宣伝, D: 情報提供・調査",
            },
            reason: {
              type: "string",
              description: "判定理由（20文字以内）",
            },
          },
          required: ["is_listed", "category", "reason"],
          additionalProperties: false,
        },
        strict: false,
      },
    ],
    tool_choice: {
      type: "function",
      name: "evaluatePR",
    },
    parallel_tool_calls: false,
  };
};

export const passesGptFilter = async (
  prId: string,
  title: string,
  summary: string,
): Promise<GptFilterResult> => {
  const apiKey = getApiKey();
  const calledAt = new Date().toISOString();

  const defaultResult: GptFilterResult = {
    isListed: false,
    category: "D",
    reason: "parse error",
    passed: false,
    calledAt,
  };

  const request = buildRequest(title, summary);

  try {
    const response = await axios({
      method: "post",
      url: API_URL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      data: request,
      timeout: 60000,
    });

    await appendLog(prId, request, response.data);

    // Responses APIのレスポンス形式からFunction Callの結果を取得
    const output = response.data.output;
    if (!output || !Array.isArray(output)) {
      console.error("Unexpected response format: no output array");
      return defaultResult;
    }

    // function_call タイプのoutputを探す
    const functionCallOutput = output.find(
      (item: any) => item.type === "function_call" && item.name === "evaluatePR"
    );

    if (!functionCallOutput) {
      console.error("No function_call output found");
      return defaultResult;
    }

    const decision = parseDecision(functionCallOutput.arguments);
    if (!decision) {
      return defaultResult;
    }

    const passed = decision.is_listed === true && decision.category === "A";

    return {
      isListed: decision.is_listed,
      category: decision.category,
      reason: decision.reason,
      passed,
      calledAt,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await appendLog(prId, request, null, errorMessage);
    console.error("GPT filter error:", error);
    return defaultResult;
  }
};
