import { db } from "../index.js";
import { posts, feedFollows, feeds } from "../schema.js";
import { desc, eq } from "drizzle-orm";

export async function createPost(data: {
  title: string;
  url: string;
  description?: string | null;
  publishedAt?: Date | null;
  feedId: string;
}) {
  const [result] = await db
    .insert(posts)
    .values({
      title: data.title,
      url: data.url,
      description: data.description ?? null,
      publishedAt: data.publishedAt ?? null,
      feedId: data.feedId,
    })
    .returning();

  return result;
}

export async function getPostsForUser(userId: string, limit: number) {
  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedName: feeds.name,
    })
    .from(posts)
    .innerJoin(feeds, eq(posts.feedId, feeds.id))
    .innerJoin(feedFollows, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(limit);

  return results;
}