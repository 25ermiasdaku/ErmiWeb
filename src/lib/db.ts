import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { seed } from "../../db/seed";

/**
 * Single SQLite connection for the whole server process.
 *
 * We use Node's built-in `node:sqlite` (Node >= 22.5) rather than a native
 * addon, so there is no compile step and no node-gyp on Windows.
 *
 * The connection is opened **lazily**. Next.js imports page modules while
 * collecting build data, and several workers do that at once; opening the
 * database at import time made them contend for the same file and fail with
 * "database is locked". Nothing touches disk until a query actually runs.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ermi.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

export type Param = string | number | bigint | null | Uint8Array;
export type Row = Record<string, unknown>;

declare global {
  // Reuse the handle across Next.js dev hot reloads instead of leaking connections.
  // eslint-disable-next-line no-var
  var __ermiDb: DatabaseSync | undefined;
}

function isBusy(error: unknown): boolean {
  const e = error as { errcode?: number; code?: string; message?: string };
  return e?.errcode === 5 || e?.code === "SQLITE_BUSY" || /database is locked|database is busy/i.test(e?.message ?? "");
}

/** Retry a statement that lost a race for the file lock. */
function withRetry<T>(fn: () => T, attempts = 6): T {
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (error) {
      if (!isBusy(error) || i === attempts - 1) throw error;
      // Synchronous backoff: this runs on the server, not in a hot render loop.
      const until = Date.now() + 50 * (i + 1);
      while (Date.now() < until) {
        /* spin briefly */
      }
    }
  }
  throw new Error("unreachable");
}

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  return withRetry(() => {
    const database = new DatabaseSync(DB_PATH);

    // Set the busy timeout first, so every later statement benefits from it.
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA foreign_keys = ON;");
    // Switching journal mode needs a brief exclusive lock; it is a no-op
    // once the file is already in WAL.
    database.exec("PRAGMA journal_mode = WAL;");

    // Idempotent: every statement is CREATE ... IF NOT EXISTS.
    database.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    addColumns(database);

    // Demo data is opt-in. By default an empty database stays empty, so you can
    // build your own cafe with plain SQL. Run `npm run db:reset` to seed, or set
    // ERMI_SEED=1 to seed automatically the first time the app opens the file.
    if (process.env.ERMI_SEED === "1" && isEmpty(database)) {
      seed(database);
    }

    return database;
  });
}

/**
 * Columns added after the first release.
 *
 * `CREATE TABLE IF NOT EXISTS` never touches a table that already exists, so
 * schema.sql alone cannot add a column to somebody's existing data/ermi.db.
 * Each entry is applied once and then the helper is a no-op, which keeps the
 * seed and reset scripts (which drop everything) free of special cases.
 *
 * Adding a row here is the whole migration story for this project: append,
 * never edit an existing one, and give the new column a DEFAULT or NULL so old
 * rows stay valid.
 */
const ADDED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  // Customer ordering. Confirmed by the customer, not the staff member.
  { table: "orders", column: "confirmed_at", definition: "TEXT" },
  { table: "orders", column: "collected_at", definition: "TEXT" },
  // Links a customer account to the loyalty record that collects their points.
  { table: "users", column: "member_id", definition: "INTEGER REFERENCES members(id) ON DELETE SET NULL" },
];

function addColumns(database: DatabaseSync): void {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const existing = database
      .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?`)
      .get(table, column) as { n: number };
    if (existing.n === 0) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/** True when the catalogue has not been populated. */
function isEmpty(database: DatabaseSync): boolean {
  const row = database.prepare("SELECT COUNT(*) AS n FROM menu_items").get() as { n: number };
  return row.n === 0;
}

let handle: DatabaseSync | undefined = globalThis.__ermiDb;

/** The connection, opened on first use. */
function conn(): DatabaseSync {
  if (!handle) {
    handle = open();
    globalThis.__ermiDb = handle;
  }
  return handle;
}

/** node:sqlite returns null-prototype rows; copy them to plain objects. */
function plain<T>(row: unknown): T {
  return { ...(row as Row) } as T;
}

function prepare(sql: string): StatementSync {
  return conn().prepare(sql);
}

export function all<T = Row>(sql: string, ...params: Param[]): T[] {
  return prepare(sql).all(...params).map((r) => plain<T>(r));
}

export function get<T = Row>(sql: string, ...params: Param[]): T | undefined {
  const row = prepare(sql).get(...params);
  return row === undefined ? undefined : plain<T>(row);
}

export function run(
  sql: string,
  ...params: Param[]
): { changes: number; lastInsertRowid: number } {
  const r = prepare(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

export function scalar(sql: string, ...params: Param[]): number {
  const row = get<Row>(sql, ...params);
  if (!row) return 0;
  const first = Object.values(row)[0];
  return typeof first === "number" ? first : Number(first ?? 0);
}

/** Run `fn` inside a transaction, rolling back on any throw. */
export function tx<T>(fn: () => T): T {
  const database = conn();
  database.exec("BEGIN");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
