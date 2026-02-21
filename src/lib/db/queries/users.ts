import { db } from "../index.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";

export async function createUser(name: string) {
  const [result] = await db.insert(users).values({ name }).returning();
  return result;
}

export async function getUserByName(name: string) {
  const [result] = await db.select().from(users).where(eq(users.name, name));
  return result; // undefined إذا مش موجود
}

export async function deleteAllUsers() {
  const result = await db.delete(users);
  return result;
}

export async function getUsers() {
  const results = await db.select().from(users);
  return results;
}

