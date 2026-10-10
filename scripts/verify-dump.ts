/** Verify db/ermi-seed.sql loads into a brand-new empty database. */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sql = fs.readFileSync("db/ermi-seed.sql", "utf8");
const fresh = new DatabaseSync(":memory:");

try {
  fresh.exec(sql);
} catch (error) {
  console.error("FAILED to load dump:", error instanceof Error ? error.message : error);
  process.exit(1);
}

const tables = fresh
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as Array<{ name: string }>;

console.log(`Loaded OK — ${tables.length} tables\n`);

let total = 0;
for (const { name } of tables) {
  const { n } = fresh.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number };
  total += n;
  console.log(`  ${name.padEnd(20)} ${String(n).padStart(5)}`);
}
console.log(`\n${total} rows total`);

// Prove referential integrity actually holds in the reloaded copy.
const checks: Array<[string, string]> = [
  ["order_items without an order", "SELECT COUNT(*) AS n FROM order_items oi LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL"],
  ["recipe ingredients without stock", "SELECT COUNT(*) AS n FROM recipe_ingredients ri LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id WHERE i.id IS NULL"],
  ["orders pointing at missing members", "SELECT COUNT(*) AS n FROM orders o LEFT JOIN members m ON m.id=o.member_id WHERE o.member_id IS NOT NULL AND m.id IS NULL"],
  ["loyalty rows without a member", "SELECT COUNT(*) AS n FROM loyalty_txns t LEFT JOIN members m ON m.id=t.member_id WHERE m.id IS NULL"],
];
let clean = true;
console.log("");
for (const [label, q] of checks) {
  const { n } = fresh.prepare(q).get() as { n: number };
  if (n > 0) clean = false;
  console.log(`  ${n === 0 ? "OK  " : "BAD "} ${label}: ${n}`);
}
console.log(`\nintegrity: ${clean ? "all references resolve" : "BROKEN"}`);
