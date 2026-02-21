import { db } from "../index.js";
import { feeds, users } from "../schema.js";
import { eq, sql } from "drizzle-orm";
import { asc } from "drizzle-orm";


export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db.insert(feeds).values({ name, url, userId }).returning();
  return result;
}

export async function getFeedsWithUsers() {
  const results = await db
    .select({
      feedName: feeds.name,
      feedUrl: feeds.url,
      userName: users.name,
    })
    .from(feeds)
    .innerJoin(users, eq(feeds.userId, users.id));

  return results;
}

export async function getFeedByUrl(url: string) {
  const [result] = await db.select().from(feeds).where(eq(feeds.url, url));
  return result;
}

export async function markFeedFetched(feedId: string) {
  const now = new Date();
  const [result] = await db
    .update(feeds)
    .set({ lastFetchedAt: now, updatedAt: now })
    .where(eq(feeds.id, feedId))
    .returning();
  return result;
}

export async function getNextFeedToFetch() {
  const [result] = await db
    .select()
    .from(feeds)
    // NULLS FIRST مش موجودة دايمًا كـ ORM مباشر، فبنستخدم raw SQL
    .orderBy(sql`${feeds.lastFetchedAt} asc nulls first`)
    .limit(1);

  return result;
}

