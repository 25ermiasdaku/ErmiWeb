/**
 * Create the local database from db/schema.sql with EMPTY tables.
 *
 *   npm run db:setup
 *
 * No demo data. Every table exists and is ready for your own rows, which you
 * can add with plain SQL:
 *
 *   sqlite3 data/ermi.db
 *   sqlite> .read db/schema.sql
 *   sqlite> INSERT INTO categories (slug, name, sort_order) VALUES ('espresso', 'Espresso', 0);
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "ermi.db");
const schemaPath = path.join(root, "db", "schema.sql");

const force = process.argv.includes("--force");

if (fs.existsSync(dbPath) && !force) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const { n: items } = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get() as { n: number };
  const { n: orders } = db.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
  db.close();

  if (items > 0 || orders > 0) {
    console.log(`${path.relative(root, dbPath)} already exists and has data in it.`);
    console.log(`  menu_items: ${items}   orders: ${orders}`);
    console.log("\nTo replace it with an empty schema, re-run with --force:");
    console.log("  npm run db:setup -- --force");
    process.exit(0);
  }
  console.log(`${path.relative(root, dbPath)} already exists and is empty. Nothing to do.`);
  process.exit(0);
}

fs.mkdirSync(dataDir, { recursive: true });
for (const suffix of ["-wal", "-shm"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 });
}
fs.rmSync(dbPath, { force: true, maxRetries: 5, retryDelay: 100 });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync(schemaPath, "utf8"));

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all() as Array<{ name: string }>;

console.log(`Created ${path.relative(root, dbPath)} from db/schema.sql — ${tables.length} tables, no rows.\n`);
for (const { name } of tables) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number };
  console.log(`  ${name.padEnd(20)} ${String(n).padStart(3)} rows`);
}

const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
db.close();
console.log(`\nintegrity_check: ${integrity.integrity_check}`);
console.log("\nStart the app with:  npm run dev");
