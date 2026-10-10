/**
 * Drop, recreate and re-seed the local database.
 *
 *   npm run db:reset
 *
 * Safe to run while `next dev` is up: if the database file is locked
 * (Windows keeps it open, and SQLite runs in WAL mode) we fall back to
 * dropping the tables in place instead of deleting the file.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seed } from "../db/seed.ts";

const root = process.cwd();
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "ermi.db");

function removeDbFiles(): boolean {
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 });
    }
    return true;
  } catch {
    return false;
  }
}

function dropAllTables(db: DatabaseSync): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  db.exec("PRAGMA foreign_keys = OFF;");
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  db.exec("PRAGMA foreign_keys = ON;");
}

const removed = removeDbFiles();
const db = new DatabaseSync(dbPath);
if (!removed) {
  console.log("Database file is locked — dropping tables in place instead.\n");
  dropAllTables(db);
}
db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
seed(db);

const counts = [
  "categories",
  "menu_items",
  "item_options",
  "orders",
  "order_items",
  "order_events",
  "inventory_items",
  "inventory_txns",
  "recipes",
  "recipe_steps",
  "recipe_ingredients",
  "members",
  "loyalty_txns",
  "rewards",
  "restock_orders",
  "permissions",
  "roles",
  "role_permissions",
  "users",
  "sessions",
  "activity_log",
] as const;

console.log(`Seeded ${path.relative(root, dbPath)}`);
for (const table of counts) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  console.log(`  ${table.padEnd(20)} ${String(row.n).padStart(5)}`);
}

const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
console.log(`\nintegrity_check: ${integrity.integrity_check}`);
db.close();
