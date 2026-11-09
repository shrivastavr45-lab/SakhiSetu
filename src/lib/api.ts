import { useEffect, useState } from "react";
import type { Campaign, Profile, Scheme } from "./data";
import type { L } from "./i18n";

const API_BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiEnvelope<T> = { data: T };

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, maxRetries: number, error: unknown) => void;
};

// Global reactive server-starting state for Render cold starts
let activeStartingRequests = 0;
const serverStartingListeners = new Set<(isStarting: boolean) => void>();

export function isServerStarting(): boolean {
  return activeStartingRequests > 0;
}

export function subscribeServerStarting(listener: (isStarting: boolean) => void): () => void {
  serverStartingListeners.add(listener);
  return () => {
    serverStartingListeners.delete(listener);
  };
}

function notifyServerStarting(starting: boolean) {
  for (const listener of serverStartingListeners) {
    try {
      listener(starting);
    } catch {
      // Ignore listener error
    }
  }
}

function incrementStarting() {
  activeStartingRequests++;
  if (activeStartingRequests === 1) {
    notifyServerStarting(true);
  }
}

function decrementStarting() {
  if (activeStartingRequests > 0) {
    activeStartingRequests--;
    if (activeStartingRequests === 0) {
      notifyServerStarting(false);
    }
  }
}

export function useServerStarting(): boolean {
  const [starting, setStarting] = useState(isServerStarting);
  useEffect(() => {
    setStarting(isServerStarting());
    return subscribeServerStarting(setStarting);
  }, []);
  return starting;
}

/** Check if HTTP status indicates a temporary upstream/gateway issue during cold starts */
export function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** Check if an error represents a temporary network or upstream availability failure */
export function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return isTransientStatus(error.status);
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const msg = error.message.toLowerCase();
    return (
      error instanceof TypeError ||
      name === "aborterror" ||
      name === "timeouterror" ||
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("upstream") ||
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("connection refused")
    );
  }
  return false;
}

/** Calculate exponential backoff delay with bounded jitter */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs = 1200,
  maxDelayMs = 8000,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(maxDelayMs, exponential + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const {
    body: _bodyRaw,
    retries: customRetries,
    retryDelayMs: customBaseDelay,
    timeoutMs: customTimeout,
    onRetry,
    signal: userSignal,
    ...restOptions
  } = options;

  const method = (options.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD";

  // Safeguard: Never automatically retry donation creation or payment mutations
  const isDonationOrPayment = path.startsWith("/donations") || path.includes("/donations");

  let maxRetries = 0;
  if (!isDonationOrPayment) {
    if (customRetries !== undefined) {
      maxRetries = Math.max(0, customRetries);
    } else if (isIdempotent) {
      maxRetries = 3; // 1 initial attempt + up to 3 retries = 4 total attempts
    }
  }

  const baseDelayMs = customBaseDelay ?? 1200;
  const timeoutMs = customTimeout ?? 15_000;

  let requestTrackedAsStarting = false;

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let abortController: AbortController | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let combinedSignal: AbortSignal | null = userSignal ?? null;

      if (timeoutMs > 0) {
        abortController = new AbortController();
        timer = setTimeout(() => {
          abortController?.abort(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        if (userSignal) {
          if (userSignal.aborted) {
            clearTimeout(timer);
            throw userSignal.reason ?? new Error("Aborted");
          }
          userSignal.addEventListener("abort", () => {
            abortController?.abort(userSignal!.reason);
          });
        }
        combinedSignal = abortController.signal;
      }

      let response: Response | undefined;
      let networkError: unknown;

      try {
        response = await fetch(`${API_BASE}${path}`, {
          ...restOptions,
          method,
          headers,
          credentials: "include",
          signal: combinedSignal ?? null,
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        });
      } catch (err) {
        networkError = err;
      } finally {
        if (timer) clearTimeout(timer);
      }

      // 1. If fetch threw a network/timeout error
      if (!response) {
        const transient = isTransientError(networkError);
        if (transient && attempt < maxRetries) {
          if (!requestTrackedAsStarting) {
            requestTrackedAsStarting = true;
            incrementStarting();
          }
          onRetry?.(attempt + 1, maxRetries, networkError);
          const delay = calculateBackoffDelay(attempt, baseDelayMs);
          await sleep(delay);
          continue;
        }

        const msg = networkError instanceof Error ? networkError.message : "Network request failed";
        throw new ApiError(502, "UPSTREAM_UNREACHABLE", `Request failed (502): ${msg}`);
      }

      // 2. If response has a transient HTTP status (502, 503, 504)
      if (isTransientStatus(response.status) && attempt < maxRetries) {
        if (!requestTrackedAsStarting) {
          requestTrackedAsStarting = true;
          incrementStarting();
        }
        onRetry?.(
          attempt + 1,
          maxRetries,
          new ApiError(response.status, "TRANSIENT_HTTP_ERROR", `HTTP ${response.status}`),
        );
        const delay = calculateBackoffDelay(attempt, baseDelayMs);
        await sleep(delay);
        continue;
      }

      // 3. Response is returned (success or non-retryable error)
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : null;

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? (payload as { error?: { code?: string; message?: string } }).error
            : undefined;
        throw new ApiError(
          response.status,
          error?.code ?? "REQUEST_FAILED",
          error?.message ?? `Request failed (${response.status}).`,
        );
      }

      if (payload && typeof payload === "object" && "data" in payload) {
        return (payload as ApiEnvelope<T>).data;
      }
      return payload as T;
    }

    throw new ApiError(502, "RETRIES_EXHAUSTED", "Request failed (502).");
  } finally {
    if (requestTrackedAsStarting) {
      decrementStarting();
    }
  }
}

export type SessionUser = { id: string; name: string; email: string; role: "DONOR" | "ADMIN" };
export type DonationHistoryItem = {
  id: string;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  testMode: boolean;
  createdAt: string;
  campaign: { id: string; title: L };
  receipt: { id: string; receiptNumber: string } | null;
};

export type SchemeListResult = {
  schemes: Scheme[];
  total: number;
  limit: number;
  offset: number;
};

export async function getSchemes(filters: { q?: string; need?: string; district?: string; level?: string; drafts?: boolean; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.need) query.set("need", filters.need);
  if (filters.district) query.set("district", filters.district);
  if (filters.level) query.set("level", filters.level);
  if (filters.limit !== undefined) query.set("limit", String(filters.limit));
  if (filters.offset !== undefined) query.set("offset", String(filters.offset));
  const path = filters.drafts ? "/admin/schemes" : "/schemes";
  return request<SchemeListResult>(`${path}${query.size ? `?${query.toString()}` : ""}`);
}

export const getScheme = (id: string) => request<Scheme>(`/schemes/${encodeURIComponent(id)}`);
export const getCampaigns = (includeInactive = false) => request<Campaign[]>(includeInactive ? "/admin/campaigns" : "/campaigns");
export const checkEligibility = (profile: Profile) => request<{ results: (Scheme & { match?: { rulesApplied: string[]; unansweredRules: string[]; hasStructuredRules?: boolean } })[]; count: number; basis: string }>("/eligibility", { method: "POST", body: profile });

export const registerDonor = (body: { name: string; email: string; password: string }) => request<{ user: SessionUser }>("/auth/register", { method: "POST", body });
export const login = (body: { email: string; password: string }) => request<{ user: SessionUser }>("/auth/login", { method: "POST", body });
export const logout = () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
export const getMe = () => request<{ user: SessionUser }>("/auth/me");

export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `sakhi-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export type DonationResult = {
  status: "SUCCEEDED" | "FAILED";
  mode: "TEST";
  donation: {
    id: string;
    donorName: string;
    amount: number;
    frequency: "ONE_TIME" | "MONTHLY";
    campaignId: string;
    status: "SUCCEEDED" | "FAILED";
    createdAt: string;
    paidAt: string | null;
    paymentReference: string;
  };
  receipt: { id: string; receiptNumber: string; downloadToken: string | null; downloadUrl: string; previewOnly: boolean } | null;
};

export const getHealth = () =>
  request<{ status: string; database: string; paymentMode: string }>("/health");

export function createDonation(
  body: { campaignId: string; amount: number; frequency: "ONE_TIME" | "MONTHLY"; donorName: string; donorEmail: string; pan: string },
  idempotencyKey: string,
  simulateFailure = false,
) {
  return request<DonationResult>("/donations", {
    method: "POST",
    retries: 0, // Strict safeguard: Never automatically retry donation creation
    headers: {
      "Idempotency-Key": idempotencyKey,
      ...(simulateFailure ? { "X-Test-Payment-Outcome": "failed" } : {}),
    },
    body,
  });
}

export async function downloadReceipt(receiptId: string, downloadToken?: string | null) {
  const headers = new Headers();
  if (downloadToken) headers.set("X-Receipt-Token", downloadToken);
  const response = await fetch(`${API_BASE}/receipts/${encodeURIComponent(receiptId)}.pdf`, { credentials: "include", headers });
  if (!response.ok) {
    let message = `Receipt download failed (${response.status}).`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new ApiError(response.status, "RECEIPT_DOWNLOAD_FAILED", message);
  }
  return response.blob();
}

export const getMyDonations = () => request<DonationHistoryItem[]>("/donations/mine");
export type AdminDonation = DonationHistoryItem & {
  donorName: string;
  donorEmail: string;
  paidAt: string | null;
  paymentReference: string;
  donorPanLast4: string | null;
};
export const getAdminDonations = () => request<AdminDonation[]>("/admin/donations");

export type AdminDonorSummary = {
  userId: string;
  name: string;
  email: string;
  panLast4: string | null;
  totalAmount: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  latestDonationAt: string | null;
  campaignIds: string[];
};

export type AdminDonorDonation = {
  id: string;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  testMode: boolean;
  paidAt: string | null;
  paymentReference: string;
  createdAt: string;
  campaign: { id: string; title: L };
  receipt: { id: string; receiptNumber: string } | null;
};

export const getAdminDonors = () => request<AdminDonorSummary[]>("/admin/donors");
export const getAdminDonorDonations = (userId: string) =>
  request<AdminDonorDonation[]>(`/admin/donors/${encodeURIComponent(userId)}/donations`);

export type AdminReceipt = {
  id: string;
  receiptNumber: string;
  generatedAt: string;
  donationId: string;
  donorName: string;
  donorEmail: string;
  donorPanLast4: string | null;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  testMode: boolean;
  paidAt: string | null;
  campaign: { id: string; title: L };
};

export const getAdminReceipts = () => request<AdminReceipt[]>("/admin/receipts");

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: Array<{ row: number; reason: string }>;
};

/**
 * Sends raw CSV text to POST /admin/import/schemes/csv.
 * Uses fetch directly (not the request() helper) because the body is
 * text/csv, not JSON. The admin session cookie is sent via credentials: "include".
 */
export async function importSchemesCsv(csvText: string): Promise<ImportSummary> {
  const response = await fetch(`${API_BASE}/admin/import/schemes/csv`, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    credentials: "include",
    body: csvText,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() as unknown : null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
    throw new ApiError(response.status, error?.code ?? "IMPORT_FAILED", error?.message ?? `Import failed (${response.status}).`);
  }
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: ImportSummary }).data;
  throw new ApiError(500, "IMPORT_PARSE_ERROR", "The server returned an unexpected response format.");
}
export const createAdminScheme = (body: Record<string, unknown> & { need: string; name: L }) => request<Scheme>("/admin/schemes", { method: "POST", body });
export const updateAdminScheme = (id: string, body: Record<string, unknown>) => request<Scheme>(`/admin/schemes/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteAdminScheme = (id: string) => request<{ deleted: boolean }>(`/admin/schemes/${encodeURIComponent(id)}`, { method: "DELETE" });
export const updateAdminCampaign = (id: string, body: { goalAmount?: number; active?: boolean }) => request<Campaign>(`/admin/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const getHomepageBanner = () => request<{ text: string | null }>("/settings/homepage-banner");
export const updateHomepageBanner = (text: string) => request<{ text: string }>("/admin/settings/homepage-banner", { method: "PUT", body: { text } });
export const getAuditLog = (limit = 50) => request<AuditLogRow[]>(`/admin/settings/audit-log?limit=${limit}`);

export type AuditLogRow = {
  id: string;
  adminId: string | null;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminReportSummary = {
  generatedAt: string;
  periodLabel: string;
  financialYear: string;
  totalSucceededAmount: number;
  totalSucceededCount: number;
  totalFailedCount: number;
  totalPendingCount: number;
  uniqueDonorEmails: number;
  oneTimeDonations: number;
  monthlyIntentions: number;
  testModeOnly: true;
  monthly: Array<{ monthKey: string; monthLabel: string; amount: number; count: number }>;
  byCampaign: Array<{
    id: string;
    title: L;
    emoji: string;
    district: string;
    active: boolean;
    goalAmount: number;
    collectedAmount: number;
    donationCount: number;
    progressPercent: number;
  }>;
  disclaimers: string[];
};

export const getAdminReportSummary = () => request<AdminReportSummary>("/admin/reports/summary");

/** Downloads the Form 10BD demo CSV for the given financial year (e.g. "2026-27").
 *  Returns a Blob; caller creates an object URL and triggers download. */
export async function downloadForm10BdCsv(fy: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/admin/reports/form-10bd.csv?fy=${encodeURIComponent(fy)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    let message = `Form 10BD export failed (${response.status}).`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch { /* keep status message */ }
    throw new ApiError(response.status, "FORM_10BD_FAILED", message);
  }
  return response.blob();
}
export const askAssistant = (message: string, language: "hi" | "en") => request<{ answer: string; language: "hi" | "en" }>("/assistant", { method: "POST", body: { message, language } });
export const draftSchemeSummary = (id: string) => request<{ schemeId: string; draft: string; status: string }>(`/admin/ai/schemes/${encodeURIComponent(id)}/summary-draft`, { method: "POST" });
export const approveSchemeSummary = (id: string) => request<Scheme>(`/admin/ai/schemes/${encodeURIComponent(id)}/summary-approve`, { method: "POST" });
export const dismissSchemeSummary = (id: string) => request<{ dismissed: boolean }>(`/admin/ai/schemes/${encodeURIComponent(id)}/summary-dismiss`, { method: "POST" });

export type AdminOverviewData = {
  stats: {
    totalSuccessfulAmount: number;
    successfulDonationsCount: number;
    uniqueDonorsCount: number;
    activeCampaignsCount: number;
    totalCampaignsCount: number;
    publishedSchemesCount: number;
    totalSchemesCount: number;
    pendingDonationsCount: number;
    failedDonationsCount: number;
  };
  recentDonations: Array<{
    id: string;
    donorName: string;
    donorEmail: string;
    amount: number;
    frequency: "ONE_TIME" | "MONTHLY";
    status: "SUCCEEDED" | "PENDING" | "FAILED";
    campaignId: string;
    campaignTitle: L;
    receiptNumber: string | null;
    createdAt: string;
  }>;
  campaignCollections: Array<{
    id: string;
    title: L;
    district: string;
    emoji: string;
    active: boolean;
    goalAmount: number;
    collectedAmount: number;
    donationCount: number;
    remainingAmount: number;
    progressPercent: number;
  }>;
  monthlyTrends: Array<{
    monthKey: string;
    monthLabel: string;
    amount: number;
    count: number;
  }>;
};

export const getAdminOverview = () => request<AdminOverviewData>("/admin/overview");
