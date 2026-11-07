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
type WorkerEnv = {
  /** Full base URL of the Render backend Web Service, no trailing slash.
   *  Example: https://sakhisetu-api.onrender.com
   *  Set in Cloudflare Pages → Settings → Environment variables.
   *  When absent the proxy returns 502 with a clear error.
   */
  BACKEND_URL?: string;
};

/**
 * Proxy an /api/* request to the Render backend.
 *
 * - Preserves method, headers (minus hop-by-hop), and body.
 * - Returns the upstream response (including Set-Cookie) unchanged so that
 *   session cookies set by the Render API arrive at the browser correctly.
 * - GET/HEAD requests are forwarded without a body.
 */
async function proxyToBackend(request: Request, env: WorkerEnv): Promise<Response> {
  const backendBase = env.BACKEND_URL?.replace(/\/$/, "");
  if (!backendBase) {
    return new Response(
      JSON.stringify({ error: { code: "PROXY_MISCONFIGURED", message: "BACKEND_URL is not configured on this Pages deployment. Set it in Cloudflare Pages → Settings → Environment variables." } }),
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    return new Response(
      JSON.stringify({ error: { code: "UPSTREAM_UNREACHABLE", message: `Could not reach the SakhiSetu API: ${message}` } }),
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
  async fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    // Proxy all /api/* requests to the Render backend before the SSR handler
    // sees them. This keeps the API and frontend on the same origin so that
    // SameSite=Lax session cookies flow correctly without CORS issues.
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return proxyToBackend(request, env);
    }

    // All other requests go through the TanStack Start SSR handler.
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
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
