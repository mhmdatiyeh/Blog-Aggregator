import { createUser, getUserByName, deleteAllUsers, getUsers } from "./lib/db/queries/users.js";
import { readConfig, setUser } from "./config.js";
import { fetchFeed } from "./rss.js";
import type { Feed, User } from "./lib/db/schema.js";
import { createFeed, getFeedsWithUsers, getFeedByUrl, getNextFeedToFetch, markFeedFetched } from "./lib/db/queries/feeds.js";
import { createFeedFollow, getFeedFollowsForUser, deleteFeedFollowByUserAndUrl } from "./lib/db/queries/feed_follows.js";
import { createPost } from "./lib/db/queries/posts.js";

type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
type CommandsRegistry = Record<string, CommandHandler>;
type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

async function handlerRegister(cmdName: string, ...args: string[]) {
  if (args.length < 1) {
    throw new Error(`${cmdName} command requires a username`);
  }

  const username = args[0];

  const existing = await getUserByName(username);
  if (existing) {
    throw new Error(`User '${username}' already exists`);
  }

  const user = await createUser(username);

  setUser(username);
  console.log(`User created: ${username}`);
  console.log(user); // debugging
}

async function handlerLogin(cmdName: string, ...args: string[]) {
  if (args.length < 1) {
    throw new Error(`${cmdName} command requires a username`);
  }

  const username = args[0];

  const user = await getUserByName(username);
  if (!user) {
    throw new Error(`User '${username}' does not exist`);
  }

  setUser(username);
  console.log(`Logged in as ${username}`);
}

function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler) {
  registry[cmdName] = handler;
}

function printFeed(feed: Feed, user: User) {
  console.log(`* Feed: ${feed.name}`);
  console.log(`  URL: ${feed.url}`);
  console.log(`  Added by: ${user.name}`);
  console.log(`  Feed ID: ${feed.id}`);
  console.log(`  User ID: ${feed.userId}`);
  console.log(`  Created: ${feed.createdAt}`);
  console.log(`  Updated: ${feed.updatedAt}`);
}

function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
  return async (cmdName: string, ...args: string[]) => {
    const cfg = readConfig();
    if (!cfg.currentUserName) {
      throw new Error("No user is currently logged in");
    }

    const user = await getUserByName(cfg.currentUserName);
    if (!user) {
      throw new Error(`User '${cfg.currentUserName}' not found`);
    }

    await handler(cmdName, user as User, ...args);
  };
}

function parsePublishedAt(pubDate: string): Date | null {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function scrapeFeeds() {
  const nextFeed = await getNextFeedToFetch();
  if (!nextFeed) {
    console.log("No feeds to fetch yet.");
    return;
  }

  console.log(`Fetching: ${nextFeed.name} - ${nextFeed.url}`);

  // نعلّمها fetched مباشرة (زي المطلوب)
  await markFeedFetched(nextFeed.id);

  const rss = await fetchFeed(nextFeed.url);

  for (const item of rss.channel.item) {
    try {
      await createPost({
        title: item.title,
        url: item.link,
        description: item.description,
        publishedAt: parsePublishedAt(item.pubDate),
        feedId: nextFeed.id,
      });
    } catch (err) {
      // إذا نفس الرابط انحفظ قبل: unique url رح يعمل duplicate
      // نتجاهله لأنه طبيعي مع التكرار
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("duplicate")) {
        console.error(`Error saving post: ${msg}`);
      }
    }
  }
}

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);
  if (!match) {
    throw new Error(`Invalid duration: ${durationStr}. Use formats like 1s, 1m, 500ms, 1h`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      throw new Error("Invalid duration unit");
  }
}

async function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]) {
  const handler = registry[cmdName];
  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }
  await handler(cmdName, ...args);
}

async function handlerReset(cmdName: string, ...args: string[]) {
  // reset ما بده args، بس لو المستخدم كتب زيادة ما بنهتم
  await deleteAllUsers();
  console.log("Database reset: users cleared");
}

async function handlerUsers(cmdName: string, ...args: string[]) {
  const cfg = readConfig();
  const current = cfg.currentUserName;

  const allUsers = await getUsers();

  for (const u of allUsers) {
    const suffix = current && u.name === current ? " (current)" : "";
    console.log(`* ${u.name}${suffix}`);
  }
}

async function handlerAgg(cmdName: string, ...args: string[]) {
  if (args.length < 1) {
    throw new Error(`${cmdName} command requires time_between_reqs (e.g. 1s, 1m, 1h)`);
  }

  const durationStr = args[0];
  const timeBetweenRequests = parseDuration(durationStr);

  console.log(`Collecting feeds every ${durationStr}`);

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
  };

  // شغل مرة فورًا
  await scrapeFeeds().catch(handleError);

  const interval = setInterval(() => {
    scrapeFeeds().catch(handleError);
  }, timeBetweenRequests);

  // خليه شغال لحد Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

async function handlerAddFeed(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 2) {
    throw new Error(`${cmdName} command requires: name and url`);
  }

  const name = args[0];
  const url = args[1];

  const feed = await createFeed(name, url, user.id);

  const ff = await createFeedFollow(user.id, feed.id);
  console.log(`${ff.userName} is now following ${ff.feedName}`);

  printFeed(feed as Feed, user as User);
}

async function handlerFeeds(cmdName: string, ...args: string[]) {
  const rows = await getFeedsWithUsers();

  for (const r of rows) {
    console.log(`* ${r.feedName}`);
    console.log(`  URL: ${r.feedUrl}`);
    console.log(`  Added by: ${r.userName}`);
  }
}

async function handlerFollow(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 1) {
    throw new Error(`${cmdName} command requires a feed url`);
  }

  const url = args[0];

  const feed = await getFeedByUrl(url);
  if (!feed) {
    throw new Error(`Feed not found for url: ${url}`);
  }

  const ff = await createFeedFollow(user.id, feed.id);
  console.log(`${ff.userName} is now following ${ff.feedName}`);
}

async function handlerFollowing(cmdName: string, user: User, ...args: string[]) {
  const follows = await getFeedFollowsForUser(user.id);

  for (const f of follows) {
    console.log(`* ${f.feedName}`);
  }
}

async function handlerUnfollow(cmdName: string, user: User, ...args: string[]) {
  if (args.length < 1) {
    throw new Error(`${cmdName} command requires a feed url`);
  }

  const url = args[0];

  const deleted = await deleteFeedFollowByUserAndUrl(user.id, url);

  // لو استخدمت returning()
  if (Array.isArray(deleted) && deleted.length === 0) {
    throw new Error(`You are not following: ${url}`);
  }

  console.log(`${user.name} unfollowed ${url}`);
}

async function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerUsers);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));

  const argv = process.argv.slice(2);

  if (argv.length < 1) {
    console.error("Error: not enough arguments provided");
    process.exit(1);
  }

  const cmdName = argv[0];
  const args = argv.slice(1);

  try {
    await runCommand(registry, cmdName, ...args);
    process.exit(0); // نجاح
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1); // فشل
  }
}

main();