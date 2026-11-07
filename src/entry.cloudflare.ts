import "#nitro/virtual/polyfills";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { useNitroApp } from "nitro/app";
import { proxyToBackend, type WorkerEnv } from "./server";

// eslint-disable-next-line react-hooks/rules-of-hooks
const nitroApp = useNitroApp();

function augmentReq(cfReq: Request, ctx: { env: unknown; context: unknown }) {
  const req = cfReq as unknown as {
    ip?: string;
    runtime?: Record<string, unknown>;
    waitUntil?: (promise: Promise<unknown>) => void;
  };
  const ip = cfReq.headers.get("cf-connecting-ip");
  if (ip) {
    req.ip = ip;
  }
  req.runtime ??= { name: "cloudflare" };
  req.runtime["cloudflare"] = {
    ...((req.runtime["cloudflare"] as Record<string, unknown>) || {}),
    ...ctx,
  };
  const execCtx = ctx.context as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
  if (typeof execCtx?.waitUntil === "function") {
    req.waitUntil = execCtx.waitUntil.bind(execCtx);
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, context: unknown): Promise<Response> {
    (globalThis as unknown as { __env__?: unknown }).__env__ = env;
    augmentReq(request, { env, context });

    const url = new URL(request.url);

    // 1. Cloudflare ASSETS binding for static files
    const cfEnv = env as { ASSETS?: { fetch: (req: Request) => Promise<Response> } };
    if (cfEnv?.ASSETS && isPublicAssetURL(url.pathname)) {
      return cfEnv.ASSETS.fetch(request);
    }

    // 2. API requests: proxy directly to backend with authentic Cloudflare Worker env
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return proxyToBackend(request, env);
    }

    // 3. All other requests: TanStack Start SSR via Nitro
    return nitroApp.fetch(request);
  },
};
