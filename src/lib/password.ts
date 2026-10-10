/**
 * Password hashing, built on Node's scrypt.
 *
 * We avoid bcrypt/argon2 because they are native addons and this project
 * deliberately has no compile step (see db.ts). scrypt is a memory-hard KDF
 * and ships in Node's standard library.
 *
 * Deliberately imports nothing from ./db, so the seed script can hash
 * passwords without opening the database.
 */
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

// Cost parameters. N=16384 needs roughly 16 MB, which is under Node's 32 MB
// default maxmem. Raising N means raising maxmem too.
const N = 16384;
const KEYLEN = 64;
const SALT_BYTES = 16;
const SCRYPT_PARAMS = { N, r: 8, p: 1 } as const;

export const MIN_PASSWORD_LENGTH = 8;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function digest(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize("NFKC"), salt, KEYLEN, SCRYPT_PARAMS);
}

/** Hash a password for storage. Returns "saltHex:hashHex". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * The same thing, synchronously. The seed is a synchronous function and
 * hashing four demo accounts costs a fraction of a second, which is not worth
 * making the whole seed async for.
 */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = digest(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * Check a password against a stored digest. Returns false for anything
 * malformed rather than throwing, so a corrupt row cannot break the login
 * page.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;

  const actual = digest(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

/**
 * Validate a new password, returning a message to show the user or null when
 * it is acceptable.
 */
export function passwordProblem(
  password: string,
  context: { username?: string; fullName?: string; email?: string } = {},
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) {
    return "That password is unreasonably long.";
  }
  const lower = password.toLowerCase();
  const personal = [context.username, context.fullName, context.email]
    .filter((v): v is string => Boolean(v))
    .flatMap((v) => v.toLowerCase().split(/[\s@._-]+/))
    .filter((v) => v.length >= 4);
  if (personal.some((part) => lower.includes(part))) {
    return "Do not use any part of your name, username or email.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "That is just one character repeated.";
  }
  return null;
}

/** A 4-character suffix for temporary passwords, e.g. "K7QP". */
export function tempPasswordSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}
