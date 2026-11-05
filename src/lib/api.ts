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

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const { body: _bodyRaw, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers,
    credentials: "include",
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() as unknown : null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
    throw new ApiError(response.status, error?.code ?? "REQUEST_FAILED", error?.message ?? `Request failed (${response.status}).`);
  }
  if (payload && typeof payload === "object" && "data" in payload) return (payload as ApiEnvelope<T>).data;
  return payload as T;
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

export async function getSchemes(filters: { q?: string; need?: string; district?: string; drafts?: boolean } = {}) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.need) query.set("need", filters.need);
  if (filters.district) query.set("district", filters.district);
  const path = filters.drafts ? "/admin/schemes" : "/schemes";
  return request<Scheme[]>(`${path}${query.size ? `?${query.toString()}` : ""}`);
}

export const getScheme = (id: string) => request<Scheme>(`/schemes/${encodeURIComponent(id)}`);
export const getCampaigns = (includeInactive = false) => request<Campaign[]>(includeInactive ? "/admin/campaigns" : "/campaigns");
export const checkEligibility = (profile: Profile) => request<{ results: (Scheme & { match?: { rulesApplied: string[]; unansweredRules: string[] } })[]; count: number; basis: string }>("/eligibility", { method: "POST", body: profile });

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

export function createDonation(
  body: { campaignId: string; amount: number; frequency: "ONE_TIME" | "MONTHLY"; donorName: string; donorEmail: string; pan: string },
  idempotencyKey: string,
  simulateFailure = false,
) {
  return request<DonationResult>("/donations", {
    method: "POST",
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
export const createAdminScheme = (body: Record<string, unknown> & { need: string; name: L }) => request<Scheme>("/admin/schemes", { method: "POST", body });
export const updateAdminScheme = (id: string, body: Record<string, unknown>) => request<Scheme>(`/admin/schemes/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteAdminScheme = (id: string) => request<{ deleted: boolean }>(`/admin/schemes/${encodeURIComponent(id)}`, { method: "DELETE" });
export const updateAdminCampaign = (id: string, body: { goalAmount?: number; active?: boolean }) => request<Campaign>(`/admin/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const getHomepageBanner = () => request<{ text: string | null }>("/settings/homepage-banner");
export const updateHomepageBanner = (text: string) => request<{ text: string }>("/admin/settings/homepage-banner", { method: "PUT", body: { text } });
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
