import axios from "axios";
import Parser from "rss-parser";
import cron from "node-cron";
import crypto from "crypto";
import { evaluateText } from "./filter";
import { appendRecord, readAllRecords, StoredRecord } from "./storage";
import { generateReport } from "./report";

const RSS_URLS = ["https://prtimes.jp/rss"];

const parser = new Parser();

type FetchedRecord = StoredRecord & { matched: boolean };

const createId = (title: string, link: string): string => {
  return crypto
    .createHash("sha256")
    .update(`${title}-${link}`)
    .digest("hex");
};

const fetchFeed = async (url: string): Promise<FetchedRecord[]> => {
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    maxRedirects: 5,
  });
  const feed = await parser.parseString(res.data);

  return (feed.items || []).map((item) => {
    const title = item.title ?? "";
    const link = item.link ?? "";
    const description = item.contentSnippet ?? item.content ?? item.summary ?? "";
    const pubDate = item.pubDate ?? new Date().toISOString();

    const combined = `${title} ${description}`;
    const filterResult = evaluateText(combined);
    const id = createId(title, link);

    return {
      id,
      title,
      summary: description,
      publishedAt: pubDate,
      source: "PRTimes",
      matchedKeywords: filterResult.matchedKeywords,
      link,
      matched: filterResult.matched,
    };
  });
};

const runFetch = async (): Promise<void> => {
  const appended: StoredRecord[] = [];
  for (const url of RSS_URLS) {
    const items = await fetchFeed(url);
    for (const item of items) {
      if (!item.matched) {
        continue;
      }
      const { matched, ...record } = item;
      await appendRecord(record);
      appended.push(record);
    }
  }

  const existing = await readAllRecords();
  await generateReport(existing);

  if (appended.length > 0) {
    console.log(`Appended ${appended.length} records.`);
  } else {
    console.log("No matching records found.");
  }
};

const startCron = (): void => {
  cron.schedule("*/10 * * * *", () => {
    runFetch().catch((error) => {
      console.error("Failed to fetch RSS:", error);
    });
  });
  console.log("Cron scheduled: every 10 minutes.");
};

runFetch().catch((error) => {
  console.error("Initial fetch failed:", error);
});
startCron();
