import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import serverDefault, {
  proxyToBackend,
  resolveWorkerContext,
  resolveWorkerEnv,
  type WorkerEnv,
} from "../server";

describe("Cloudflare Worker runtime proxy & environment resolution", () => {
  const originalGlobalEnv = (globalThis as unknown as { __env__?: unknown }).__env__;
  const originalProcessBackendUrl = process.env["BACKEND_URL"];

  beforeEach(() => {
    delete (globalThis as unknown as { __env__?: unknown }).__env__;
    delete process.env["BACKEND_URL"];
  });

  afterEach(() => {
    if (originalGlobalEnv !== undefined) {
      (globalThis as unknown as { __env__?: unknown }).__env__ = originalGlobalEnv;
    } else {
      delete (globalThis as unknown as { __env__?: unknown }).__env__;
    }

    if (originalProcessBackendUrl !== undefined) {
      process.env["BACKEND_URL"] = originalProcessBackendUrl;
    } else {
      delete process.env["BACKEND_URL"];
    }

    vi.restoreAllMocks();
  });

  describe("resolveWorkerEnv", () => {
    it("resolves from passedEnv argument when provided", () => {
      const passedEnv: WorkerEnv = { BACKEND_URL: "https://passed-env.example.com" };
      const env = resolveWorkerEnv(undefined, passedEnv);
      expect(env.BACKEND_URL).toBe("https://passed-env.example.com");
    });

    it("resolves from request.runtime.cloudflare.env (Nitro Cloudflare module runtime)", () => {
      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { env?: WorkerEnv } };
      };
      req.runtime = {
        cloudflare: {
          env: { BACKEND_URL: "https://nitro-runtime-req.example.com" },
        },
      };

      const env = resolveWorkerEnv(req, undefined);
      expect(env.BACKEND_URL).toBe("https://nitro-runtime-req.example.com");
    });

    it("resolves from globalThis.__env__ (Nitro Cloudflare global handler)", () => {
      (globalThis as unknown as { __env__?: unknown }).__env__ = {
        BACKEND_URL: "https://nitro-global-env.example.com",
      };

      const env = resolveWorkerEnv(undefined, undefined);
      expect(env.BACKEND_URL).toBe("https://nitro-global-env.example.com");
    });

    it("falls back to process.env.BACKEND_URL when available", () => {
      process.env["BACKEND_URL"] = "https://process-env.example.com";
      const env = resolveWorkerEnv(undefined, undefined);
      expect(env.BACKEND_URL).toBe("https://process-env.example.com");
    });

    it("prioritizes passedEnv > request.runtime > globalThis.__env__ > process.env", () => {
      process.env["BACKEND_URL"] = "https://level-4-process.example.com";
      (globalThis as unknown as { __env__?: unknown }).__env__ = {
        BACKEND_URL: "https://level-3-global.example.com",
      };

      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { env?: WorkerEnv } };
      };
      req.runtime = {
        cloudflare: {
          env: { BACKEND_URL: "https://level-2-req.example.com" },
        },
      };

      // When passedEnv is present, it wins
      expect(
        resolveWorkerEnv(req, { BACKEND_URL: "https://level-1-passed.example.com" }).BACKEND_URL,
      ).toBe("https://level-1-passed.example.com");

      // When passedEnv is undefined, request.runtime wins
      expect(resolveWorkerEnv(req, undefined).BACKEND_URL).toBe("https://level-2-req.example.com");

      // When request has no runtime, globalThis.__env__ wins
      const plainReq = new Request("https://sakhisetu.test/api/health");
      expect(resolveWorkerEnv(plainReq, undefined).BACKEND_URL).toBe(
        "https://level-3-global.example.com",
      );
    });
  });

  describe("resolveWorkerContext", () => {
    it("returns passedCtx if supplied", () => {
      const dummyCtx = { waitUntil: vi.fn() };
      expect(resolveWorkerContext(undefined, dummyCtx)).toBe(dummyCtx);
    });

    it("resolves from request.runtime.cloudflare.context", () => {
      const dummyCtx = { waitUntil: vi.fn() };
      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { context?: unknown } };
      };
      req.runtime = {
        cloudflare: {
          context: dummyCtx,
        },
      };

      expect(resolveWorkerContext(req, undefined)).toBe(dummyCtx);
    });
  });

  describe("proxyToBackend", () => {
    it("returns 502 with PROXY_MISCONFIGURED when BACKEND_URL is missing", async () => {
      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, {});

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error?.code).toBe("PROXY_MISCONFIGURED");
    });

    it("forwards request method, query string, stripped headers, and returns upstream response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "ok" } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "session=abc123; Path=/; HttpOnly; SameSite=Lax",
          },
        }),
      );

      const req = new Request("https://sakhisetu.test/api/schemes?need=education&page=1", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Host: "sakhisetu.test",
          Connection: "keep-alive",
          Cookie: "session=abc123",
          "X-Custom-Client": "test-client",
        },
      });

      const res = await proxyToBackend(req, { BACKEND_URL: "https://backend.example.com/" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];

      // Verifies URL construction with trailing slash trimmed
      expect(calledUrl).toBe("https://backend.example.com/api/schemes?need=education&page=1");
      expect(calledInit?.method).toBe("GET");

      const sentHeaders = calledInit?.headers as Headers;
      // Hop-by-hop headers must be stripped
      expect(sentHeaders.has("host")).toBe(false);
      expect(sentHeaders.has("connection")).toBe(false);
      // Valid client headers must be preserved
      expect(sentHeaders.get("accept")).toBe("application/json");
      expect(sentHeaders.get("cookie")).toBe("session=abc123");
      expect(sentHeaders.get("x-custom-client")).toBe("test-client");

      // Verifies response status, body, and Set-Cookie preservation
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toBe("session=abc123; Path=/; HttpOnly; SameSite=Lax");
      const body = await res.json();
      expect(body).toEqual({ data: { status: "ok" } });
    });

    it("returns 502 with UPSTREAM_UNREACHABLE on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, { BACKEND_URL: "https://down-service.example.com" });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error?.code).toBe("UPSTREAM_UNREACHABLE");
      expect(json.error?.message).toContain("Connection refused");
    });
  });

  describe("default.fetch Cloudflare runtime integration", () => {
    it("handles /api/health with undefined env parameter without throwing TypeError", async () => {
      // Simulate Cloudflare Workers + Nitro execution:
      // Nitro sets globalThis.__env__ and request.runtime.cloudflare.env,
      // but passes (request) to ssr.fetch() with env=undefined!
      (globalThis as unknown as { __env__?: unknown }).__env__ = {
        BACKEND_URL: "https://sakhisetu.onrender.com",
      };

      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { env?: WorkerEnv } };
      };
      req.runtime = {
        cloudflare: {
          env: { BACKEND_URL: "https://sakhisetu.onrender.com" },
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "ok", database: "connected" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Crucial: env is undefined here, simulating exactly what Nitro does in lazyService!
      const res = await serverDefault.fetch(req, undefined as unknown as WorkerEnv, undefined);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ data: { status: "ok", database: "connected" } });
    });
  });
});
