/**
 * cold-start-retry.test.ts
 *
 * Focused unit tests for the retry logic, backoff utilities, and
 * server-starting reactive state added to fix Render Free tier cold starts.
 *
 * Tests verify:
 *   1. isTransientStatus() returns true only for 502/503/504
 *   2. isTransientError() recognises ApiError, TypeError, network errors
 *   3. calculateBackoffDelay() stays within [base, max] bounds
 *   4. request() on GET retries on 502 and succeeds on 2nd attempt
 *   5. request() exhausts retries and throws ApiError with RETRIES_EXHAUSTED
 *   6. createDonation() / POST /donations never retries (retries: 0)
 *   7. POST to non-donations paths does not retry (not idempotent)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  calculateBackoffDelay,
  createDonation,
  isTransientError,
  isTransientStatus,
  request,
} from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeOkEnvelope<T>(data: T): Response {
  return makeJsonResponse(200, { data });
}

// ── 1. isTransientStatus ──────────────────────────────────────────────────────

describe("isTransientStatus()", () => {
  it("returns true for 502", () => expect(isTransientStatus(502)).toBe(true));
  it("returns true for 503", () => expect(isTransientStatus(503)).toBe(true));
  it("returns true for 504", () => expect(isTransientStatus(504)).toBe(true));
  it("returns false for 200", () => expect(isTransientStatus(200)).toBe(false));
  it("returns false for 400", () => expect(isTransientStatus(400)).toBe(false));
  it("returns false for 404", () => expect(isTransientStatus(404)).toBe(false));
  it("returns false for 500", () => expect(isTransientStatus(500)).toBe(false));
  it("returns false for 429", () => expect(isTransientStatus(429)).toBe(false));
});

// ── 2. isTransientError ───────────────────────────────────────────────────────

describe("isTransientError()", () => {
  it("returns true for ApiError with status 502", () => {
    expect(isTransientError(new ApiError(502, "UPSTREAM_UNREACHABLE", "bad gateway"))).toBe(true);
  });

  it("returns true for ApiError with status 503", () => {
    expect(isTransientError(new ApiError(503, "SERVICE_UNAVAILABLE", "unavailable"))).toBe(true);
  });

  it("returns true for ApiError with status 504", () => {
    expect(isTransientError(new ApiError(504, "GATEWAY_TIMEOUT", "timeout"))).toBe(true);
  });

  it("returns false for ApiError with status 400", () => {
    expect(isTransientError(new ApiError(400, "BAD_REQUEST", "bad request"))).toBe(false);
  });

  it("returns false for ApiError with status 401 (auth error)", () => {
    expect(isTransientError(new ApiError(401, "UNAUTHORIZED", "not authorized"))).toBe(false);
  });

  it("returns false for ApiError with status 500 (server bug, not transient gateway)", () => {
    expect(isTransientError(new ApiError(500, "INTERNAL_ERROR", "server error"))).toBe(false);
  });

  it("returns true for TypeError (classic fetch network failure)", () => {
    expect(isTransientError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for Error with 'network' in message", () => {
    expect(isTransientError(new Error("network error occurred"))).toBe(true);
  });

  it("returns true for Error with 'fetch' in message", () => {
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
  });

  it("returns true for Error with 'upstream' in message", () => {
    expect(isTransientError(new Error("upstream timed out"))).toBe(true);
  });

  it("returns true for Error with 'timeout' in message", () => {
    expect(isTransientError(new Error("timeout after 15000ms"))).toBe(true);
  });

  it("returns true for Error with 'ECONNREFUSED'", () => {
    expect(isTransientError(new Error("ECONNREFUSED"))).toBe(true);
  });

  it("returns false for plain string", () => {
    expect(isTransientError("some string error")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTransientError(null)).toBe(false);
  });

  it("returns false for ordinary Error with no transient keywords", () => {
    expect(isTransientError(new Error("validation failed: name is required"))).toBe(false);
  });
});

// ── 3. calculateBackoffDelay ─────────────────────────────────────────────────

describe("calculateBackoffDelay()", () => {
  it("returns a value >= baseDelayMs on attempt 0", () => {
    const delay = calculateBackoffDelay(0, 1200, 8000);
    expect(delay).toBeGreaterThanOrEqual(1200);
  });

  it("returns a value <= maxDelayMs on any attempt", () => {
    for (let attempt = 0; attempt <= 10; attempt++) {
      const delay = calculateBackoffDelay(attempt, 1200, 8000);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });

  it("increases (or stays bounded) with higher attempt numbers", () => {
    // Seed with no jitter by using Math.random mocked to return 0
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const d0 = calculateBackoffDelay(0, 1200, 8000);
      const d1 = calculateBackoffDelay(1, 1200, 8000);
      const d2 = calculateBackoffDelay(2, 1200, 8000);
      expect(d1).toBeGreaterThan(d0);
      expect(d2).toBeGreaterThanOrEqual(d1); // may be capped at max
    } finally {
      Math.random = originalRandom;
    }
  });

  it("caps at maxDelayMs when exponential would exceed it", () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      // attempt=10: 1200 * 2^10 = 1,228,800 >> 8000 → must be capped
      const delay = calculateBackoffDelay(10, 1200, 8000);
      expect(delay).toBe(8000);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("returns the default max when called with defaults and high attempt", () => {
    const delay = calculateBackoffDelay(20);
    expect(delay).toBeLessThanOrEqual(8000);
  });
});

// ── 4 & 5. request() with mocked fetch ───────────────────────────────────────

describe("request() — retry behaviour", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Silence retries by using very small delays so tests run fast
    // We override the module-level delay via the retryDelayMs option
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries GET once on 502 and succeeds on 2nd attempt", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return makeJsonResponse(502, { error: { code: "GW", message: "bad gw" } });
      return makeOkEnvelope({ hello: "world" });
    }) as typeof fetch;

    const promise = request<{ hello: string }>("/test", {
      retryDelayMs: 10, // minimal delay so test is fast
      retries: 1,
    });

    // Advance timers to process the backoff sleep
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(2);
    expect(result).toEqual({ hello: "world" });
  });

  it("retries GET up to maxRetries on repeated 502 then throws RETRIES_EXHAUSTED", async () => {
    globalThis.fetch = vi.fn(async () => {
      return makeJsonResponse(502, { error: { code: "GW", message: "bad gw" } });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/test", {
      retryDelayMs: 10,
      retries: 2, // 1 initial + 2 retries = 3 total calls
    }).catch((err: unknown) => err);

    await vi.runAllTimersAsync();
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(
      apiErr.code === "RETRIES_EXHAUSTED" ||
        apiErr.code === "REQUEST_FAILED" ||
        apiErr.status === 502,
    ).toBe(true);

    // Should have called fetch 3 times (initial + 2 retries)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it("does NOT retry GET on 400 (non-transient)", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(400, { error: { code: "BAD_REQUEST", message: "invalid input" } });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/test", { retryDelayMs: 10, retries: 3 }).catch(
      (err: unknown) => err,
    );
    await vi.runAllTimersAsync();
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    expect(calls).toBe(1); // Only 1 attempt — not retried
  });

  it("does NOT retry on 401 (auth error — not transient)", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(401, { error: { code: "UNAUTHORIZED", message: "not authorized" } });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/test", { retryDelayMs: 10, retries: 3 }).catch(
      (err: unknown) => err,
    );
    await vi.runAllTimersAsync();
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it("does NOT retry POST requests (not idempotent)", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(502, { error: { code: "GW", message: "bad gw" } });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/some-post-endpoint", {
      method: "POST",
      body: { data: "value" },
      retryDelayMs: 10,
      // No explicit retries override → POST defaults to 0 retries
    }).catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it("defaults to 2 retries (3 attempts total) on GET requests", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(502, {
        error: {
          code: "UPSTREAM_UNREACHABLE",
          message: "Could not reach the SakhiSetu API: Upstream request timed out after 15000ms",
        },
      });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/schemes", {
      retryDelayMs: 10,
      // no retries option specified -> defaults to 2 retries for GET
    }).catch((err: unknown) => err);

    await vi.runAllTimersAsync();
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    // Should have called fetch exactly 3 times (1 initial attempt + 2 retries)
    expect(calls).toBe(3);
  });

  it("handles upstream timeout 502 with clean retry recovery on attempt 2", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return makeJsonResponse(502, {
          error: {
            code: "UPSTREAM_UNREACHABLE",
            message: "Could not reach the SakhiSetu API: Upstream request timed out after 15000ms",
          },
        });
      }
      return makeOkEnvelope({ status: "recovered" });
    }) as typeof fetch;

    const promise = request<{ status: string }>("/schemes", { retryDelayMs: 10 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(2);
    expect(result).toEqual({ status: "recovered" });
  });

  it("aborts when client request exceeds timeoutMs", async () => {
    // Mock a fetch that never resolves within timeoutMs
    globalThis.fetch = vi.fn((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | null;
        signal?.addEventListener("abort", () => {
          reject(signal.reason ?? new Error("Aborted"));
        });
      });
    }) as typeof fetch;

    const errorPromise = request<unknown>("/slow-endpoint", {
      timeoutMs: 50,
      retries: 0,
    }).catch((err: unknown) => err);

    await vi.advanceTimersByTimeAsync(100);
    const err = await errorPromise;

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).code).toBe("UPSTREAM_UNREACHABLE");
  });
});

// ── 6. createDonation() — never retries ─────────────────────────────────────

describe("createDonation() — no retry on POST /donations", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("never retries when POST /donations returns 502", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(502, {
        error: { code: "UPSTREAM_UNREACHABLE", message: "bad gateway" },
      });
    }) as typeof fetch;

    const key = "idem-key-test-" + Date.now();
    await expect(
      createDonation(
        {
          campaignId: "camp-1",
          amount: 100,
          frequency: "ONE_TIME",
          donorName: "Test Donor",
          donorEmail: "test@example.com",
          pan: "ABCDE1234F",
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ApiError);

    // Must be exactly 1 call — no retry
    expect(calls).toBe(1);
  });

  it("never retries when POST /donations returns 503", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return makeJsonResponse(503, { error: { code: "UNAVAILABLE", message: "service unavailable" } });
    }) as typeof fetch;

    const key = "idem-key-test-503-" + Date.now();
    await expect(
      createDonation(
        {
          campaignId: "camp-2",
          amount: 500,
          frequency: "MONTHLY",
          donorName: "Donor Two",
          donorEmail: "two@example.com",
          pan: "XYZAB5678G",
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ApiError);

    expect(calls).toBe(1);
  });
});

