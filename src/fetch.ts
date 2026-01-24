import Parser from "rss-parser";
import cron from "node-cron";
import crypto from "crypto";
import { execSync } from "child_process";
import { evaluateText } from "./filter";
import { passesGptFilter } from "./gptFilter";
import { appendRecord, readAllRecords, StoredRecord } from "./storage";
import { generateReport } from "./report";

const RSS_URLS = ["https://prtimes.jp/index.rdf"];
const CURL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const parser = new Parser();

type FetchedRecord = StoredRecord & { matched: boolean };

const sanitizeXml = (xml: string): string => {
  return xml.replace(/&(?![a-zA-Z]+;|#\d+;)/g, "&amp;");
};

const fetchXml = async (url: string): Promise<string> => {
  const command = `curl -L -A "${CURL_USER_AGENT}" "${url}"`;
  return execSync(command, { encoding: "utf-8" });
};

const ensureXmlLooksLikeFeed = (xml: string, url: string): void => {
  const trimmed = xml.trimStart().slice(0, 200).toLowerCase();
  if (
    !trimmed.startsWith("<rss") &&
    !trimmed.startsWith("<?xml") &&
    !trimmed.startsWith("<feed") &&
    !trimmed.startsWith("<rdf")
  ) {
    throw new Error(`Feed response for ${url} was not XML/RSS.`);
  }
};

const createId = (title: string, link: string): string => {
  return crypto
    .createHash("sha256")
    .update(`${title}-${link}`)
    .digest("hex");
};

const fetchFeed = async (url: string): Promise<FetchedRecord[]> => {
  const xml = await fetchXml(url);
  ensureXmlLooksLikeFeed(xml, url);
  const sanitizedXml = sanitizeXml(xml);
  const feed = await parser.parseString(sanitizedXml);

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
  const failures: string[] = [];
  const existingRecords = await readAllRecords();
  const existingIds = new Set(existingRecords.map((record) => record.id));
  for (const url of RSS_URLS) {
    try {
      const items = await fetchFeed(url);
      for (const item of items) {
        if (!item.matched) {
          continue;
        }
        const { matched, ...record } = item;
        if (existingIds.has(record.id)) {
          continue;
        }
        const gptApproved = await passesGptFilter(record.title, record.summary);
        if (!gptApproved) {
          continue;
        }
        await appendRecord(record);
        existingIds.add(record.id);
        appended.push(record);
      }
    } catch (error) {
      failures.push(url);
      console.error(`Failed to fetch feed: ${url}`, error);
    }
  }

  await generateReport([...existingRecords, ...appended]);

  if (appended.length > 0) {
    console.log(`Appended ${appended.length} records.`);
  } else {
    console.log("No matching records found.");
  }

  if (failures.length === RSS_URLS.length) {
    console.warn("All feed URLs failed to load.");
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
