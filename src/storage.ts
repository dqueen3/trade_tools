import { promises as fs } from "fs";
import path from "path";

export type StoredRecord = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  source: "PRTimes";
  matchedKeywords: string[];
  link: string;
  gptCategory: "A" | "B" | "C" | "D";
  gptReason: string;
  gptIsListed: boolean;
  gptPassed: boolean;
  gptCalledAt: string;
};

const DATA_DIR = path.resolve(__dirname, "..", "data");
const JSONL_PATH = path.join(DATA_DIR, "pr_raw.jsonl");

const ensureDataDir = async (): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

export const appendRecord = async (record: StoredRecord): Promise<void> => {
  await ensureDataDir();
  const line = `${JSON.stringify(record)}\n`;
  await fs.appendFile(JSONL_PATH, line, "utf8");
};

export const readAllRecords = async (): Promise<StoredRecord[]> => {
  try {
    const data = await fs.readFile(JSONL_PATH, "utf8");
    return data
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const RETENTION_DAYS = 30;

export const cleanupOldRejectedRecords = async (): Promise<number> => {
  const records = await readAllRecords();
  const now = Date.now();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const filtered = records.filter((record) => {
    if (record.gptPassed) {
      return true;
    }
    const calledAt = new Date(record.gptCalledAt).getTime();
    return now - calledAt < retentionMs;
  });

  const removedCount = records.length - filtered.length;
  if (removedCount > 0) {
    const content = filtered.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await fs.writeFile(JSONL_PATH, content, "utf8");
  }

  return removedCount;
};

export { JSONL_PATH };
