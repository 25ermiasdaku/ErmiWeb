/**
 * Customer self-registration, shared by the public web form and the mobile API.
 *
 * Account and loyalty record are created together in one transaction. The
 * `users.member_id` link is what lets an order find somewhere to bank its
 * points, so a customer who registers and orders straight away must arrive with
 * both rows already in place — unlike a staff account, which earns a loyalty
 * record lazily on its first self-order.
 *
 * This module is intentionally NOT `"use server"`: it exports a type as well as
 * functions, and both entry points (the action and the route handler) call it
 * directly and then create a session in their own way (cookie vs bearer token).
 *
 * Security note for Phase B: email is not yet verified, so linking an existing
 * walk-in loyalty record by email trusts the address. An OTP email check before
 * that link goes live is the outstanding work.
 */
import { get, run, tx } from "./db";
import { logActivity } from "./activity";
import { hashPassword, passwordProblem } from "./password";

export type RegisterInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  /** Present from the web form; the API omits it. */
  confirmPassword?: string;
};

export type RegisterResult = {
  ok: boolean;
  message: string;
  /** Keyed by form field name, so a form can render them inline. */
  fieldErrors?: Record<string, string>;
  userId?: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return String(value ?? "").trim();
}

/** A username derived from the email local part, nudged until it is free. */
function uniqueUsername(email: string): string {
  const base = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9._-]/g, "") || "guest";
  const stem = base.slice(0, 24);
  let candidate = stem;
  let n = 1;
  while (get<{ id: number }>("SELECT id FROM users WHERE lower(username) = ?", candidate)) {
    n += 1;
    candidate = `${stem}${n}`;
  }
  return candidate;
}

export async function registerCustomer(input: RegisterInput): Promise<RegisterResult> {
  const fullName = str(input.fullName);
  const email = str(input.email).toLowerCase();
  const phone = str(input.phone);
  const password = String(input.password ?? "");
  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2) fieldErrors.full_name = "Enter your name.";
  if (fullName.length > 80) fieldErrors.full_name = "That name is too long.";
  if (!EMAIL.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (input.confirmPassword !== undefined && password !== input.confirmPassword) {
    fieldErrors.confirm_password = "The two passwords do not match.";
  }
  const problem = passwordProblem(password, { username: email, fullName, email });
  if (problem) fieldErrors.password = problem;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const taken = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ?", email);
  if (taken) {
    return {
      ok: false,
      message: "An account already uses that email. Try signing in instead.",
      fieldErrors: { email: "Already in use." },
    };
  }

  const role = get<{ id: number }>("SELECT id FROM roles WHERE slug = 'customer'");
  if (!role) {
    return {
      ok: false,
      message: "Self-registration is not set up on this cafe yet. Ask a manager to create your account.",
    };
  }

  // A walk-in loyalty record may already exist under this address (a barista
  // enrolled them at the counter). Join it rather than creating a duplicate —
  // members.email is UNIQUE, and two records would split their points.
  const existingMember = get<{ id: number }>("SELECT id FROM members WHERE lower(email) = ?", email);
  const username = uniqueUsername(email);
  const passwordHash = await hashPassword(password);

  const userId = tx(() => {
    const memberId =
      existingMember?.id ??
      Number(
        run(
          "INSERT INTO members (name, email, phone) VALUES (?, ?, ?)",
          fullName,
          email,
          phone,
        ).lastInsertRowid,
      );

    return Number(
      run(
        `INSERT INTO users (username, email, full_name, password_hash, role_id, member_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        username,
        email,
        fullName,
        passwordHash,
        role.id,
        memberId,
      ).lastInsertRowid,
    );
  });

  logActivity({
    action: "auth.register",
    entity: "user",
    entityId: userId,
    userId,
    username,
    detail: `Customer self-registration · ${email}`,
  });

  return { ok: true, message: `Welcome, ${fullName.split(" ")[0]}.`, userId };
}
