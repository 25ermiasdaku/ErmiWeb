/**
 * Export the local database to a single portable SQL file.
 *
 *   npm run db:export        -> db/ermi-seed.sql
 *
 * Load db/ermi-seed.sql into any SQLite tool (DB Browser for SQLite,
 * DBeaver, the VS Code SQLite extension) or run it with:
 *
 *   sqlite3 data/ermi.db < db/ermi-seed.sql
 *
 * The dump is re-runnable: it deletes each table's rows before inserting,
 * so importing twice does not duplicate anything.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dbPath = path.join(root, "data", "ermi.db");
const outPath = path.join(root, "db", "ermi-seed.sql");

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${path.relative(root, dbPath)}. Run: npm run db:reset`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`,
  )
  .all() as Array<{ name: string }>;

const lines: string[] = [
  "-- ============================================================",
  "--  Ermi Coffee - full local database dump",
  `--  ${tables.length} tables, generated ${new Date().toISOString()}`,
  "--  Import into any SQLite tool, or: sqlite3 data/ermi.db < this file",
  "-- ============================================================",
  "",
  "PRAGMA foreign_keys = OFF;",
  "BEGIN TRANSACTION;",
  "",
];

let rowCount = 0;

for (const { name } of tables) {
  const ddl = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { sql: string } | undefined;

  if (ddl?.sql) {
    lines.push(`-- ${name}`, `${ddl.sql.replace(/;+\s*$/, "")};`, "");
  }

  lines.push(`DELETE FROM "${name}";`);

  const rows = db.prepare(`SELECT * FROM "${name}"`).all() as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    lines.push("");
    continue;
  }

  const columns = Object.keys(rows[0]!);
  const columnList = columns.map((c) => `"${c}"`).join(", ");

  for (const row of rows) {
    const values = columns
      .map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "bigint") return String(v);
        if (typeof v === "boolean") return v ? "1" : "0";
        if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      })
      .join(", ");
    lines.push(`INSERT INTO "${name}" (${columnList}) VALUES (${values});`);
    rowCount++;
  }
  lines.push("");
}

lines.push("COMMIT;", "PRAGMA foreign_keys = ON;", "");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
db.close();

const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`Wrote ${path.relative(root, outPath)}`);
console.log(`  ${tables.length} tables, ${rowCount} rows, ${kb} KB`);
