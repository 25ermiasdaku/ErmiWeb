/**
 * Static check: every exported server action must call requireUser or
 * requirePermission. A missing guard is the one bug class that no page-level
 * test can catch, because the button is simply not rendered.
 */
import { readFileSync } from "node:fs";

const FILES = [
  "src/lib/actions.ts",
  "src/lib/admin-actions.ts",
  "src/lib/auth-actions.ts",
  "src/lib/my-order-actions.ts",
];

/** Actions that legitimately need no guard, with the reason. */
const ALLOWED: Record<string, string> = {
  // Requiring a session to sign in would be a chicken-and-egg bug. Its own
  // protections are the constant-time check, the lockout and safeNext().
  loginAction: "signing in cannot require a session",
};

let failures = 0;
let checked = 0;

for (const file of FILES) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  // Find each `export async function name(` and its body by brace depth.
  const pattern = /^export\s+(?:async\s+)?function\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = pattern.exec(lines[i]!);
    if (!m) continue;
    const name = m[1]!;

    let depth = 0;
    let started = false;
    let body = "";
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]!) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      body += lines[j] + "\n";
      if (started && depth === 0) break;
    }

    checked++;
    const guarded = /requirePermission\s*\(/.test(body) || /requireUser\s*\(/.test(body);
    const isServerModule = /^\s*["']use server["']/.test(source);

    if (!isServerModule) {
      console.log(`  FAIL  ${file} ${name}  — file is not a "use server" module`);
      failures++;
    } else if (!guarded && !ALLOWED[name]) {
      console.log(`  FAIL  ${file} ${name}  — no requireUser/requirePermission call`);
      failures++;
    } else {
      const which = /requirePermission\s*\(\s*["'`]([^"'`]+)/.exec(body);
      console.log(
        `  pass  ${file.replace("src/lib/", "").padEnd(17)} ${name.padEnd(30)} ${
          which?.[1] ?? "(requireUser)"
        }`,
      );
    }
  }
}

console.log(`\n${checked - failures}/${checked} actions guarded`);
process.exit(failures === 0 ? 0 : 1);
