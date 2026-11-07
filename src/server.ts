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
   *  Set in Cloudflare Pages / Workers → Settings → Variables and Secrets.
   *  When absent the proxy returns 502 with a clear error.
   */
  BACKEND_URL?: string;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Resolve Cloudflare Worker environment variables and bindings reliably across runtimes.
 *
 * In Nitro's Cloudflare module handler (`cloudflare-module`), Cloudflare invokes:
 *   fetch(request, env, context)
 * Nitro stores `env` onto:
 *   1. `request.runtime.cloudflare.env` (via `augmentReq`)
 *   2. `globalThis.__env__`
 * However, Nitro's internal SSR service dispatcher calls `mod.fetch(req)` passing
 * only `req`, leaving the 2nd argument (`env`) undefined when `src/server.ts` is invoked.
 *
 * This function resolves the environment bindings by inspecting, in precedence order:
 * 1. Directly passed `passedEnv` argument (if supplied with properties, e.g. in tests/invocations)
 * 2. `request.runtime.cloudflare.env` (attached to the request by Nitro runtime)
 * 3. `globalThis.__env__` (attached globally by Nitro's Cloudflare handler)
 * 4. `globalThis.env` (native Cloudflare workerd global if present)
 * 5. `process.env` (Node/Vite local dev or testing fallback)
 */
export function resolveWorkerEnv(request?: Request, passedEnv?: unknown): WorkerEnv {
  const sources: unknown[] = [
    passedEnv,
    (request as unknown as { runtime?: { cloudflare?: { env?: unknown } } })?.runtime?.cloudflare
      ?.env,
    (globalThis as unknown as { __env__?: unknown }).__env__,
    (globalThis as unknown as { env?: unknown }).env,
    typeof process !== "undefined" ? process?.env : undefined,
  ];

  const merged: Record<string, unknown> = {};
  for (let i = sources.length - 1; i >= 0; i--) {
    const src = sources[i];
    if (isRecord(src)) {
      Object.assign(merged, src);
    }
  }

  return merged as WorkerEnv;
}

/**
 * Resolve Cloudflare Worker execution context (e.g. waitUntil, passThroughOnException).
 *
 * Nitro attaches `context` to `request.runtime.cloudflare.context`.
 */
export function resolveWorkerContext(request?: Request, passedCtx?: unknown): unknown {
  if (passedCtx !== undefined && passedCtx !== null) {
    return passedCtx;
  }
  return (request as unknown as { runtime?: { cloudflare?: { context?: unknown } } })?.runtime
    ?.cloudflare?.context;
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
  const resolvedEnv = env && Object.keys(env).length > 0 ? env : resolveWorkerEnv(request);
  const backendBase =
    typeof resolvedEnv.BACKEND_URL === "string"
      ? resolvedEnv.BACKEND_URL.trim().replace(/\/$/, "")
      : "";

  if (!backendBase) {
    return new Response(
      JSON.stringify({
        error: {
          code: "PROXY_MISCONFIGURED",
          message:
            "BACKEND_URL is not configured on this Pages deployment. Set it in Cloudflare Pages → Settings → Environment variables.",
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

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method,
      headers: upstreamHeaders,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: hasBody ? (request.body as any) : undefined,
      redirect: "manual",
      // @ts-expect-error duplex is required in Node/standard fetch when body is a ReadableStream
      duplex: hasBody && request.body ? "half" : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
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

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
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
    const resolvedEnv = resolveWorkerEnv(request, env);
    const resolvedCtx = resolveWorkerContext(request, ctx);

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
