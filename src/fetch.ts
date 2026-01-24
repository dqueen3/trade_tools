import Parser from "rss-parser";
import cron from "node-cron";
import crypto from "crypto";
import axios from "axios";
import { evaluateText } from "./filter";
import { appendRecord, readAllRecords, StoredRecord } from "./storage";
import { generateReport } from "./report";

const RSS_URLS = [
  "https://prtimes.jp/rss/pressrelease",
  "https://prtimes.jp/main/html/rd/p/rss.xml",
];

const FEED_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
};

const parser = new Parser({
  xml2js: {
    strict: false,
    normalize: true,
    normalizeTags: true,
  },
});

type FetchedRecord = StoredRecord & { matched: boolean };

const sanitizeXml = (xml: string): string => {
  const cleaned = xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.replace(
    /&(?![a-zA-Z]+;|#[0-9]+;|#x[a-fA-F0-9]+;)/g,
    "&amp;"
  );
};

const fetchXml = async (url: string): Promise<string> => {
  const response = await axios.get<string>(url, {
    headers: FEED_HEADERS,
    responseType: "text",
    timeout: 15000,
    maxRedirects: 5,
    transformResponse: [(data) => data],
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Unexpected status ${response.status} for ${url}`);
  }
  return response.data ?? "";
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
  for (const url of RSS_URLS) {
    try {
      const items = await fetchFeed(url);
      for (const item of items) {
        if (!item.matched) {
          continue;
        }
        const { matched, ...record } = item;
        await appendRecord(record);
        appended.push(record);
      }
    } catch (error) {
      failures.push(url);
      console.error(`Failed to fetch feed: ${url}`, error);
    }
  }

  const existing = await readAllRecords();
  await generateReport(existing);

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
