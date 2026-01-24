import { promises as fs } from "fs";
import path from "path";
import { StoredRecord } from "./storage";

const REPORT_DIR = path.resolve(__dirname, "..", "reports");
const REPORT_PATH = path.join(REPORT_DIR, "latest.md");

const formatDateTime = (date: Date): string => {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const generateReport = async (
  records: StoredRecord[],
): Promise<void> => {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const sorted = [...records].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const lines: string[] = [];
  lines.push("# PRTimes Signal (latest)");
  lines.push(`更新: ${formatDateTime(new Date())}`);
  lines.push("");
  lines.push("## ヒット一覧");
  lines.push("");

  if (sorted.length === 0) {
    lines.push("(ヒットなし)");
  } else {
    for (const record of sorted) {
      lines.push(`### ${record.title}`);
      lines.push(`- pub: ${record.publishedAt}`);
      lines.push(`- matched: ${record.matchedKeywords.join(", ")}`);
      lines.push(`- link: ${record.link}`);
      lines.push(`- summary: ${record.summary}`);
      lines.push("");
    }
  }

  await fs.writeFile(REPORT_PATH, `${lines.join("\n")}\n`, "utf8");
};

export { REPORT_PATH };
