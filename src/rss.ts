import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const res = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const raw = parser.parse(xml);

  // نتوقع شكل: raw.rss.channel
  const channel = raw?.rss?.channel;
  if (!channel || typeof channel !== "object") {
    throw new Error("Invalid RSS feed: missing channel");
  }

  const title = channel.title;
  const link = channel.link;
  const description = channel.description;

  if (!isNonEmptyString(title) || !isNonEmptyString(link) || !isNonEmptyString(description)) {
    throw new Error("Invalid RSS feed: missing channel metadata");
  }

  // items ممكن تكون object أو array أو undefined
  let rawItems: any[] = [];
  if (channel.item) {
    rawItems = Array.isArray(channel.item) ? channel.item : [channel.item];
  }

  const items: RSSItem[] = [];

  for (const it of rawItems) {
    const itTitle = it?.title;
    const itLink = it?.link;
    const itDesc = it?.description;
    const itPubDate = it?.pubDate;

    if (
      !isNonEmptyString(itTitle) ||
      !isNonEmptyString(itLink) ||
      !isNonEmptyString(itDesc) ||
      !isNonEmptyString(itPubDate)
    ) {
      // item ناقص—نتجاهله
      continue;
    }

    items.push({
      title: itTitle,
      link: itLink,
      description: itDesc,
      pubDate: itPubDate,
    });
  }

  return {
    channel: {
      title,
      link,
      description,
      item: items,
    },
  };
}