import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import serverDefault, {
  extractBackendUrl,
  proxyToBackend,
  resolveWorkerContext,
  resolveWorkerEnv,
  type WorkerEnv,
} from "../server";
import entryCloudflareDefault from "../entry.cloudflare";

describe("Cloudflare Worker runtime proxy & environment resolution", () => {
  const originalGlobalEnv = (globalThis as unknown as { __env__?: unknown }).__env__;
  const originalGlobalScopeBackendUrl = (globalThis as unknown as { BACKEND_URL?: unknown })
    .BACKEND_URL;
  const originalProcessBackendUrl = process.env["BACKEND_URL"];

  beforeEach(() => {
    delete (globalThis as unknown as { __env__?: unknown }).__env__;
    delete (globalThis as unknown as { BACKEND_URL?: unknown }).BACKEND_URL;
    delete process.env["BACKEND_URL"];
  });

  afterEach(() => {
    if (originalGlobalEnv !== undefined) {
      (globalThis as unknown as { __env__?: unknown }).__env__ = originalGlobalEnv;
    } else {
      delete (globalThis as unknown as { __env__?: unknown }).__env__;
    }

    if (originalGlobalScopeBackendUrl !== undefined) {
      (globalThis as unknown as { BACKEND_URL?: unknown }).BACKEND_URL =
        originalGlobalScopeBackendUrl;
    } else {
      delete (globalThis as unknown as { BACKEND_URL?: unknown }).BACKEND_URL;
    }

    if (originalProcessBackendUrl !== undefined) {
      process.env["BACKEND_URL"] = originalProcessBackendUrl;
    } else {
      delete process.env["BACKEND_URL"];
    }

    vi.restoreAllMocks();
  });

  describe("extractBackendUrl", () => {
    it("extracts BACKEND_URL from plain object", () => {
      expect(extractBackendUrl({ BACKEND_URL: "https://backend.example.com" })).toBe(
        "https://backend.example.com",
      );
    });

    it("extracts BACKEND_URL from prototype getter (regression for Object.assign bug in 36cd294)", () => {
      // In workerd / V8 host objects, bindings are often accessors on the prototype
      // where Object.keys() returns [] and Object.assign({}, env) drops them.
      const proto = {};
      Object.defineProperty(proto, "BACKEND_URL", {
        get() {
          return "https://host-accessor.example.com";
        },
        enumerable: true,
      });
      const hostEnv = Object.create(proto);

      expect(Object.keys(hostEnv)).toHaveLength(0);
      expect(extractBackendUrl(hostEnv)).toBe("https://host-accessor.example.com");
    });

    it("extracts BACKEND_URL from a Proxy object without own keys", () => {
      const proxyEnv = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "BACKEND_URL") return "https://proxy-binding.example.com";
            return undefined;
          },
          ownKeys() {
            return [];
          },
        },
      );

      expect(Object.keys(proxyEnv)).toHaveLength(0);
      expect(extractBackendUrl(proxyEnv)).toBe("https://proxy-binding.example.com");
    });

    it("returns undefined for null, undefined, non-string, or empty string", () => {
      expect(extractBackendUrl(null)).toBeUndefined();
      expect(extractBackendUrl(undefined)).toBeUndefined();
      expect(extractBackendUrl({})).toBeUndefined();
      expect(extractBackendUrl({ BACKEND_URL: "" })).toBeUndefined();
      expect(extractBackendUrl({ BACKEND_URL: "   " })).toBeUndefined();
      expect(extractBackendUrl({ BACKEND_URL: 12345 })).toBeUndefined();
    });
  });

  describe("resolveWorkerEnv", () => {
    it("resolves from passedEnv argument when provided", async () => {
      const passedEnv: WorkerEnv = { BACKEND_URL: "https://passed-env.example.com" };
      const env = await resolveWorkerEnv(undefined, passedEnv);
      expect(extractBackendUrl(env)).toBe("https://passed-env.example.com");
    });

    it("resolves from request.runtime.cloudflare.env (Nitro Cloudflare module runtime)", async () => {
      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { env?: WorkerEnv } };
      };
      req.runtime = {
        cloudflare: {
          env: { BACKEND_URL: "https://nitro-runtime-req.example.com" },
        },
      };

      const env = await resolveWorkerEnv(req, undefined);
      expect(extractBackendUrl(env)).toBe("https://nitro-runtime-req.example.com");
    });

    it("resolves from request.context.cloudflare.env (H3 event context)", async () => {
      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        context?: { cloudflare?: { env?: WorkerEnv } };
      };
      req.context = {
        cloudflare: {
          env: { BACKEND_URL: "https://h3-context.example.com" },
        },
      };

      const env = await resolveWorkerEnv(req, undefined);
      expect(extractBackendUrl(env)).toBe("https://h3-context.example.com");
    });

    it("resolves from globalThis.__env__ (Nitro Cloudflare global handler)", async () => {
      (globalThis as unknown as { __env__?: unknown }).__env__ = {
        BACKEND_URL: "https://nitro-global-env.example.com",
      };

      const env = await resolveWorkerEnv(undefined, undefined);
      expect(extractBackendUrl(env)).toBe("https://nitro-global-env.example.com");
    });

    it("resolves from globalThis.BACKEND_URL (Cloudflare dashboard global scope)", async () => {
      (globalThis as unknown as { BACKEND_URL?: unknown }).BACKEND_URL =
        "https://global-scope-binding.example.com";

      const env = await resolveWorkerEnv(undefined, undefined);
      expect(extractBackendUrl(env)).toBe("https://global-scope-binding.example.com");
    });

    it("does NOT treat process.env as a substitute for Worker runtime bindings", async () => {
      // User requirement 3: Do not use process.env as a substitute for Worker runtime bindings.
      process.env["BACKEND_URL"] = "https://process-env-should-not-be-used.example.com";

      const env = await resolveWorkerEnv(undefined, undefined);
      // In Worker runtime, process.env should not be used as the binding source
      expect(extractBackendUrl(env)).toBeUndefined();
    });

    it("preserves prototype getters in host objects without erasing them", async () => {
      const proto = {};
      Object.defineProperty(proto, "BACKEND_URL", {
        get() {
          return "https://host-env.example.com";
        },
        enumerable: true,
      });
      const hostEnv = Object.create(proto);

      const env = await resolveWorkerEnv(undefined, hostEnv);
      expect(extractBackendUrl(env)).toBe("https://host-env.example.com");
    });
  });

  describe("resolveWorkerContext", () => {
    it("returns passedCtx if supplied", async () => {
      const dummyCtx = { waitUntil: vi.fn() };
      expect(await resolveWorkerContext(undefined, dummyCtx)).toBe(dummyCtx);
    });

    it("resolves from request.runtime.cloudflare.context", async () => {
      const dummyCtx = { waitUntil: vi.fn() };
      const req = new Request("https://sakhisetu.test/api/health") as Request & {
        runtime?: { cloudflare?: { context?: unknown } };
      };
      req.runtime = {
        cloudflare: {
          context: dummyCtx,
        },
      };

      expect(await resolveWorkerContext(req, undefined)).toBe(dummyCtx);
    });
  });

  describe("proxyToBackend", () => {
    it("returns 502 with PROXY_MISCONFIGURED when BACKEND_URL is completely missing", async () => {
      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, {});

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error?.code).toBe("PROXY_MISCONFIGURED");
    });

    it("proxies successfully when env is a host object with a prototype getter", async () => {
      const proto = {};
      Object.defineProperty(proto, "BACKEND_URL", {
        get() {
          return "https://backend-prototype.example.com";
        },
      });
      const hostEnv = Object.create(proto);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "ok" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, hostEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ data: { status: "ok" } });
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
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;

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

    it("returns 502 with UPSTREAM_UNREACHABLE on network error immediately without compounding wait", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, { BACKEND_URL: "https://down-service.example.com" });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error?.code).toBe("UPSTREAM_UNREACHABLE");
      expect(json.error?.message).toContain("Connection refused");
    });

    it("retries idempotent GET once on transient 502 and recovers when second attempt succeeds", async () => {
      let attempts = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(JSON.stringify({ error: { message: "Bad Gateway" } }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: { status: "ok" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const req = new Request("https://sakhisetu.test/api/health");
      const res = await proxyToBackend(req, { BACKEND_URL: "https://backend.example.com" });

      expect(res.status).toBe(200);
      expect(attempts).toBe(2);
      const json = await res.json();
      expect(json).toEqual({ data: { status: "ok" } });
    });

    it("does not retry POST requests on upstream 502", async () => {
      let attempts = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        attempts++;
        return new Response(JSON.stringify({ error: { message: "Bad Gateway" } }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      });

      const req = new Request("https://sakhisetu.test/api/donations", {
        method: "POST",
        body: JSON.stringify({ amount: 100 }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await proxyToBackend(req, { BACKEND_URL: "https://backend.example.com" });

      expect(res.status).toBe(502);
      expect(attempts).toBe(1); // Exactly 1 attempt, zero retries
    });
  });

  describe("Cloudflare Worker entry-point fetch handler integration", () => {
    it("handles /api/schemes using authentic Cloudflare Worker env binding directly", async () => {
      const proto = {};
      Object.defineProperty(proto, "BACKEND_URL", {
        get() {
          return "https://sakhisetu.onrender.com";
        },
        enumerable: true,
      });
      const workerEnv = Object.create(proto) as WorkerEnv;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "sch-1", title: "Sakhi Scheme" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const req = new Request("https://sakhisetu.shrivastavr45.workers.dev/api/schemes");
      const ctx = { waitUntil: vi.fn() };

      const res = await entryCloudflareDefault.fetch(req, workerEnv, ctx);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ data: [{ id: "sch-1", title: "Sakhi Scheme" }] });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [upstreamUrl] = fetchSpy.mock.calls[0]!;
      expect(upstreamUrl).toBe("https://sakhisetu.onrender.com/api/schemes");
    });

    it("returns 502 with PROXY_MISCONFIGURED when BACKEND_URL is not present on Cloudflare Worker env", async () => {
      const req = new Request("https://sakhisetu.shrivastavr45.workers.dev/api/schemes");
      const ctx = { waitUntil: vi.fn() };

      const res = await entryCloudflareDefault.fetch(req, {} as WorkerEnv, ctx);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error?.code).toBe("PROXY_MISCONFIGURED");
    });

    it("serves static assets via env.ASSETS binding when requested", async () => {
      const assetFetchMock = vi.fn().mockResolvedValueOnce(
        new Response("robots content", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      );
      const workerEnv = {
        ASSETS: { fetch: assetFetchMock },
      } as unknown as WorkerEnv;

      const req = new Request("https://sakhisetu.shrivastavr45.workers.dev/robots.txt");
      const ctx = { waitUntil: vi.fn() };

      const res = await entryCloudflareDefault.fetch(req, workerEnv, ctx);

      expect(res.status).toBe(200);
      expect(assetFetchMock).toHaveBeenCalledWith(req);
    });
  });
});
