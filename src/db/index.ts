import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

function open(): DB {
  const file = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/taxpro.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Idempotent: applies any pending SQL migrations from ./drizzle.
  migrate(db, { migrationsFolder: path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __taxproDb?: DB };
export const db: DB = globalForDb.__taxproDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__taxproDb = db;

export { schema };
