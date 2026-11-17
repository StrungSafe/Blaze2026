// Moderator client for the XOGrid admin API.
//
// Who is a moderator is decided by the SERVER: it checks a wallet signature against its allowlist
// (ADMIN_IDENTITIES) and hands out a one-hour session token. Nothing in the browser decides access, so this file only
// stores the token and calls the API. A user who edits the page in dev tools gets a login screen and 401 responses.

import { hub, type Summary } from "./api";

const TOKEN_KEY = "xogrid-admin-token";

export function readAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAdminToken(value: string): void {
  try {
    if (value) {
      sessionStorage.setItem(TOKEN_KEY, value);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode). The session then lasts until the page closes.
  }
}

/** Cosmetic only, for showing a menu link. The server still checks every request. */
export const hasAdminToken = (): boolean => readAdminToken() !== "";

export interface AdminSummary {
  templates: {
    total: number;
    removed: number;
    byBadge: Record<string, number>;
    withFailingChecks: number;
  };
  openFlags: number;
  reviews: number;
  recentActions: {
    actor: string;
    action: string;
    identifier: string | null;
    note: string;
    at: string;
  }[];
}

export interface AdminFlag {
  id: number;
  identifier: string;
  templateName: string;
  reason: string;
  reporter: string;
  status: string;
  createdAt: string;
}

export interface AdminUserReview {
  id: number;
  identifier: string;
  reviewer: string;
  rating: number;
  body: string;
  created_at: string;
  hidden: number;
  hidden_reason: string | null;
}

export interface AdminChallenge {
  nonce: string;
  expiresAt: string;
  message: string;
  walletSignRequest?: object;
}

export interface AdminLogin {
  token: string;
  admin: string;
  expiresAt: string;
}

/** Thrown for a 401 from a moderator route, so the page can send the person back to the login screen. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your moderator session ended. Sign in again.");
  }
}

async function call<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  try {
    return await hub<T>(path, { method, body, token });
  } catch (reason) {
    if (reason instanceof Error && /\(401\)|login required/i.test(reason.message)) {
      throw new SessionExpiredError();
    }

    throw reason;
  }
}

// ----- login (no token yet) -----

export const requestChallenge = (publicKey: string) =>
  hub<AdminChallenge>("/api/admin/challenge", { method: "POST", body: { publicKey } });

export const submitLogin = (nonce: string, signedTransaction: string) =>
  hub<AdminLogin>("/api/admin/login", {
    method: "POST",
    body: { nonce, proof: { type: "transaction", signedTransaction } },
  });

// ----- session -----

export const adminMe = (token: string) => call<{ admin: string; expiresAt: string }>(token, "/api/admin/me");

export const adminLogout = (token: string) =>
  hub("/api/admin/logout", { method: "POST", body: {}, token }).catch(() => undefined);

// ----- reading -----

export const adminSummary = (token: string) => call<AdminSummary>(token, "/api/admin/summary");

export const adminFlags = (token: string) => call<{ items: AdminFlag[] }>(token, "/api/admin/flags?status=open");

export const adminTemplates = (token: string, query: string) =>
  call<{ items: Summary[]; total: number }>(
    token,
    `/api/admin/templates?pageSize=50${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ""}`,
  );

export const adminUserReviews = (token: string) =>
  call<{ items: AdminUserReview[] }>(token, "/api/admin/user-reviews");

// ----- acting -----

export const resolveFlag = (token: string, id: number, status: "dismissed" | "upheld") =>
  call(token, `/api/admin/flags/${id}/resolve`, "POST", { status });

export const reviewTemplate = (token: string, identifier: string, note: string) =>
  call(token, `/api/admin/templates/${identifier}/review`, "POST", { note });

export const removeTemplate = (token: string, identifier: string, reason: string) =>
  call(token, `/api/admin/templates/${identifier}/remove`, "POST", { reason });

export const restoreTemplate = (token: string, identifier: string) =>
  call(token, `/api/admin/templates/${identifier}/restore`, "POST", {});

/** Replaces the whole featured list with this one template. The API replaces, it does not append. */
export const featureOnly = (token: string, identifier: string, blurb: string) =>
  call(token, "/api/admin/spotlight", "PUT", { items: [{ identifier, blurb }] });

export const hideUserReview = (token: string, id: number, reason: string) =>
  call(token, `/api/admin/user-reviews/${id}/hide`, "POST", { reason });

export const unhideUserReview = (token: string, id: number) =>
  call(token, `/api/admin/user-reviews/${id}/unhide`, "POST", {});
