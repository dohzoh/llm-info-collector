import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRequest } from "../src/api";

// Mock KV
const mockKVStore = new Map<string, string>();

vi.mock("../src/kv", () => ({
  getReleases: vi.fn(async (repo: string, _opts: { limit?: number; since?: string }) => {
    if (repo === "nonexistent/repo") return [];
    return [
      {
        id: "123",
        tag: "v1.0.0",
        name: "v1.0.0",
        url: `https://github.com/${repo}/releases/tag/v1.0.0`,
        published: "2025-01-01T00:00:00Z",
        body: "Release notes",
      },
    ];
  }),
  registerRepo: vi.fn(async (repo: string) => {
    const raw = mockKVStore.get("registered_repos") ?? "[]";
    const repos: string[] = JSON.parse(raw);
    if (!repos.includes(repo)) repos.push(repo);
    mockKVStore.set("registered_repos", JSON.stringify(repos));
  }),
  unregisterRepo: vi.fn(),
  clearRepoReleases: vi.fn(),
  listRegisteredRepos: vi.fn(async () => {
    const raw = mockKVStore.get("registered_repos") ?? "[]";
    return JSON.parse(raw) as string[];
  }),
}));

beforeEach(() => {
  mockKVStore.clear();
  vi.clearAllMocks();
});

function makeRequest(method: string, path: string, body?: unknown): Request {
  const url = `https://example.com${path}`;
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("handleRequest", () => {
  describe("GET /", () => {
    it("returns health check response", async () => {
      const req = makeRequest("GET", "/");
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const body = await json<{ status: string; timestamp: string }>(res);
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeTruthy();
    });
  });

  describe("GET /repos/{owner}/{repo}/releases", () => {
    it("returns releases for a valid repo", async () => {
      const req = makeRequest("GET", "/repos/vercel/next.js/releases");
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const body = await json<{ repo: string; releases: unknown[]; total: number }>(res);
      expect(body.repo).toBe("vercel/next.js");
      expect(body.releases).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it("accepts limit and since query params", async () => {
      const req = makeRequest("GET", "/repos/vercel/next.js/releases?limit=5&since=2024-01-01T00:00:00Z");
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid since date", async () => {
      const req = makeRequest("GET", "/repos/vercel/next.js/releases?since=not-a-date");
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const body = await json<{ error: string }>(res);
      expect(body.error).toContain("since");
    });
  });

  describe("POST /admin/repos", () => {
    it("registers a valid repo and returns 201", async () => {
      const req = makeRequest("POST", "/admin/repos", { repo: "vercel/next.js" });
      const res = await handleRequest(req);
      expect(res.status).toBe(201);
      const body = await json<{ ok: boolean; repo: string }>(res);
      expect(body.ok).toBe(true);
      expect(body.repo).toBe("vercel/next.js");
    });

    it("returns 400 for missing repo", async () => {
      const req = makeRequest("POST", "/admin/repos", {});
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid repo format", async () => {
      const req = makeRequest("POST", "/admin/repos", { repo: "invalid" });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new Request("https://example.com/admin/repos", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /admin/repos/{owner}/{repo}", () => {
    it("unregisters a repo and returns 200", async () => {
      const req = makeRequest("DELETE", "/admin/repos/vercel/next.js");
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const body = await json<{ ok: boolean; repo: string }>(res);
      expect(body.ok).toBe(true);
      expect(body.repo).toBe("vercel/next.js");
    });
  });

  describe("404 for unknown routes", () => {
    it("returns 404", async () => {
      const req = makeRequest("GET", "/unknown");
      const res = await handleRequest(req);
      expect(res.status).toBe(404);
    });

    it("returns 404 for wrong method on known route", async () => {
      const req = makeRequest("PATCH", "/");
      const res = await handleRequest(req);
      expect(res.status).toBe(404);
    });
  });
});