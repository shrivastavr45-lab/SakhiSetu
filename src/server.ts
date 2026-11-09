import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Hop-by-hop headers that must not be forwarded to the upstream API server.
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// The Worker env object — typed for the variables we read at runtime.
// All other bindings (like ASSETS) are also present but unused here.
export type WorkerEnv = {
  /** Full base URL of the Render backend Web Service, no trailing slash.
   *  Example: https://sakhisetu-api.onrender.com
   *  Set in Cloudflare Dashboard → Workers & Pages → Settings → Variables and Secrets.
   *  When absent the proxy returns 502 with a clear error.
   */
  BACKEND_URL?: string;
  [key: string]: unknown;
};

/**
 * Safely extract BACKEND_URL from any candidate environment object,
 * accessor, Proxy, or global scope without cloning or relying on own enumerable keys.
 */
export function extractBackendUrl(candidate: unknown): string | undefined {
  if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) {
    return undefined;
  }
  try {
    const val = (candidate as Record<string, unknown>)["BACKEND_URL"];
    if (typeof val === "string" && val.trim() !== "") {
      return val.trim();
    }
  } catch {
    // Ignore getter throw
  }
  return undefined;
}

/**
 * Safely import cloudflare:workers module in Cloudflare Workers runtime.
 * Using a variable specifier and /* @vite-ignore *\/ ensures Vite transform
 * does not fail during Node.js compilation/testing.
 */
async function importCloudflareWorkersModule(): Promise<{
  env?: WorkerEnv;
  default?: { env?: WorkerEnv };
  waitUntil?: (promise: Promise<unknown>) => void;
} | null> {
  try {
    const specifier = "cloudflare:workers";
    return (await import(/* @vite-ignore */ specifier)) as {
      env?: WorkerEnv;
      default?: { env?: WorkerEnv };
      waitUntil?: (promise: Promise<unknown>) => void;
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the Cloudflare Workers runtime environment for this request.
 *
 * In Nitro's Cloudflare module handler (`cloudflare-module`), Cloudflare invokes:
 *   fetch(request, env, context)
 * Nitro stores `env` onto `request.runtime.cloudflare.env` and `globalThis.__env__`.
 * In modern workerd runtime, bindings are also directly accessible via `cloudflare:workers` `env`.
 *
 * This function locates the authentic runtime `env` object or wraps the resolved bindings,
 * preserving all prototype getters, bindings, and Proxies.
 */
export async function resolveWorkerEnv(request?: Request, passedEnv?: unknown): Promise<WorkerEnv> {
  // 1. Direct argument passed to fetch handler
  if (extractBackendUrl(passedEnv)) {
    return passedEnv as WorkerEnv;
  }

  // 2. Official Cloudflare Workers runtime API (workerd)
  const cf = await importCloudflareWorkersModule();
  const cfEnv = cf?.env ?? cf?.default?.env;
  if (extractBackendUrl(cfEnv)) {
    return cfEnv as WorkerEnv;
  }

  // 3. Request runtime bindings (Nitro augmentReq)
  const reqRuntimeEnv = (request as unknown as { runtime?: { cloudflare?: { env?: unknown } } })
    ?.runtime?.cloudflare?.env;
  if (extractBackendUrl(reqRuntimeEnv)) {
    return reqRuntimeEnv as WorkerEnv;
  }

  // 4. Request context bindings (H3 / Nitro event context)
  const reqContextEnv =
    (request as unknown as { context?: { cloudflare?: { env?: unknown }; env?: unknown } })?.context
      ?.cloudflare?.env ?? (request as unknown as { context?: { env?: unknown } })?.context?.env;
  if (extractBackendUrl(reqContextEnv)) {
    return reqContextEnv as WorkerEnv;
  }

  // 5. Nitro Cloudflare handler global assignment
  const nitroGlobalEnv = (globalThis as unknown as { __env__?: unknown }).__env__;
  if (extractBackendUrl(nitroGlobalEnv)) {
    return nitroGlobalEnv as WorkerEnv;
  }

  // 6. Global worker env binding
  const globalEnv = (globalThis as unknown as { env?: unknown }).env;
  if (extractBackendUrl(globalEnv)) {
    return globalEnv as WorkerEnv;
  }

  // 7. Global scope variable (Cloudflare dashboard global or legacy binding)
  const globalUrl = (globalThis as unknown as { BACKEND_URL?: unknown }).BACKEND_URL;
  if (typeof globalUrl === "string" && globalUrl.trim() !== "") {
    return { BACKEND_URL: globalUrl.trim() };
  }

  // 8. If passedEnv is provided as an object (even without BACKEND_URL), pass it along
  if (passedEnv && typeof passedEnv === "object") {
    return passedEnv as WorkerEnv;
  }

  // 9. Fallback to Nitro global or request runtime if present
  if (reqRuntimeEnv && typeof reqRuntimeEnv === "object") {
    return reqRuntimeEnv as WorkerEnv;
  }
  if (nitroGlobalEnv && typeof nitroGlobalEnv === "object") {
    return nitroGlobalEnv as WorkerEnv;
  }

  return {};
}

/**
 * Resolve Cloudflare Worker execution context (e.g. waitUntil, passThroughOnException).
 */
export async function resolveWorkerContext(
  request?: Request,
  passedCtx?: unknown,
): Promise<unknown> {
  if (passedCtx !== undefined && passedCtx !== null) {
    return passedCtx;
  }

  const reqCtx =
    (request as unknown as { runtime?: { cloudflare?: { context?: unknown } } })?.runtime
      ?.cloudflare?.context ??
    (request as unknown as { context?: { cloudflare?: { context?: unknown } } })?.context
      ?.cloudflare?.context;
  if (reqCtx !== undefined && reqCtx !== null) {
    return reqCtx;
  }

  const cf = await importCloudflareWorkersModule();
  if (typeof cf?.waitUntil === "function") {
    return { waitUntil: cf.waitUntil };
  }

  return undefined;
}

/**
 * Proxy an /api/* request to the Render backend.
 *
 * - Preserves method, headers (minus hop-by-hop), and body.
 * - Returns the upstream response (including Set-Cookie) unchanged so that
 *   session cookies set by the Render API arrive at the browser correctly.
 * - GET/HEAD requests are forwarded without a body.
 */
export async function proxyToBackend(request: Request, env?: WorkerEnv): Promise<Response> {
  const resolvedEnv = extractBackendUrl(env)
    ? (env as WorkerEnv)
    : await resolveWorkerEnv(request, env);
  const rawBackendUrl = extractBackendUrl(resolvedEnv);
  const backendBase = rawBackendUrl ? rawBackendUrl.replace(/\/$/, "") : "";

  if (!backendBase) {
    return new Response(
      JSON.stringify({
        error: {
          code: "PROXY_MISCONFIGURED",
          message:
            "BACKEND_URL is not configured on this Cloudflare deployment. Set it in Cloudflare Dashboard → Workers & Pages → Settings → Variables and Secrets.",
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, backendBase);

  const upstreamHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const isIdempotent = method === "GET" || method === "HEAD";

  // Bound upstream subrequest timeout to 15s (ensures proxy aborts and returns 502 before browser client's 20s timeout)
  const UPSTREAM_TIMEOUT_MS = 15_000;
  // Proxy-level retry: for idempotent GET/HEAD requests, perform at most 1 quick retry on 502/503/504
  const maxAttempts = isIdempotent ? 2 : 1;

  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Brief pause between proxy-level attempts (absorbs momentary socket reset as container becomes hot)
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort(new Error(`Upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms`));
    }, UPSTREAM_TIMEOUT_MS);

    try {
      const resp = await fetch(upstreamUrl.toString(), {
        method,
        headers: upstreamHeaders,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: hasBody ? (request.body as any) : undefined,
        redirect: "manual",
        signal: abortController.signal,
        // @ts-expect-error duplex is required in Node/standard fetch when body is a ReadableStream
        duplex: hasBody && request.body ? "half" : undefined,
      });

      lastResponse = resp;
      lastError = undefined;

      // If response is not a transient gateway error (e.g. 200, 404, 400), return immediately
      if (resp.status !== 502 && resp.status !== 503 && resp.status !== 504) {
        return new Response(resp.body, {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers,
        });
      }

      // If it is transient (502/503/504) and we have attempts remaining, retry
      if (attempt < maxAttempts - 1) {
        continue;
      }
    } catch (error) {
      lastError = error;
      lastResponse = undefined;

      // Do not retry inside proxy on network errors or upstream timeouts to avoid compounding
      // user wait times; return 502 immediately so browser client handles backoff and starting UI
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastResponse) {
    return new Response(lastResponse.body, {
      status: lastResponse.status,
      statusText: lastResponse.statusText,
      headers: lastResponse.headers,
    });
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown upstream error";
  return new Response(
    JSON.stringify({
      error: {
        code: "UPSTREAM_UNREACHABLE",
        message: `Could not reach the SakhiSetu API: ${message}`,
      },
    }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  );
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env?: WorkerEnv, ctx?: unknown) {
    const resolvedEnv = await resolveWorkerEnv(request, env);
    const resolvedCtx = await resolveWorkerContext(request, ctx);

    // Proxy all /api/* requests to the Render backend before the SSR handler
    // sees them. This keeps the API and frontend on the same origin so that
    // SameSite=Lax session cookies flow correctly without CORS issues.
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return proxyToBackend(request, resolvedEnv);
    }

    // All other requests go through the TanStack Start SSR handler.
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, resolvedEnv, resolvedCtx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
