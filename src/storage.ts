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

export { JSONL_PATH };
