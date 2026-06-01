import { getReleases, registerRepo, unregisterRepo, clearRepoReleases } from "./kv";
import { isValidRepo, clampLimit, jsonResponse } from "./utils";
import type { ReleasesResponse, HealthResponse } from "./types";

/**
 * Handle all incoming HTTP requests.
 * Routes:
 *   GET  /                                        → health check
 *   GET  /repos/{owner}/{repo}/releases           → list releases
 *   POST /admin/repos                             → register repo
 *   DELETE /admin/repos/{owner}/{repo}             → unregister repo
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (request.method === "GET" && path === "/") {
    const body: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
    return jsonResponse(body);
  }

  // GET /repos/{owner}/{repo}/releases
  const releasesMatch = path.match(/^\/repos\/([^/]+)\/([^/]+)\/releases$/);
  if (request.method === "GET" && releasesMatch) {
    const owner = releasesMatch[1];
    const repo = releasesMatch[2];
    return handleGetReleases(`${owner}/${repo}`, url);
  }

  // POST /admin/repos
  if (request.method === "POST" && path === "/admin/repos") {
    return handleRegisterRepo(request);
  }

  // DELETE /admin/repos/{owner}/{repo}
  const deleteMatch = path.match(/^\/admin\/repos\/([^/]+)\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const owner = deleteMatch[1];
    const repo = deleteMatch[2];
    return handleUnregisterRepo(`${owner}/${repo}`);
  }

  return jsonResponse({ error: "Not Found" }, { status: 404 });
}

async function handleGetReleases(repo: string, url: URL): Promise<Response> {
  if (!isValidRepo(repo)) {
    return jsonResponse({ error: "Invalid repository format. Expected owner/repo." }, { status: 400 });
  }

  const limitParam = url.searchParams.get("limit");
  const limit = clampLimit(limitParam ? parseInt(limitParam, 10) : undefined);
  const since = url.searchParams.get("since") ?? undefined;

  // Validate `since` is a valid date if provided
  if (since && isNaN(Date.parse(since))) {
    return jsonResponse({ error: "Invalid `since` parameter. Expected ISO 8601 date string." }, { status: 400 });
  }

  const releases = await getReleases(repo, { limit, since });

  const body: ReleasesResponse = {
    repo,
    releases,
    total: releases.length,
  };

  return jsonResponse(body);
}

async function handleRegisterRepo(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const repo = typeof data.repo === "string" ? data.repo.trim() : "";

  if (!isValidRepo(repo)) {
    return jsonResponse({ error: "Missing or invalid `repo`. Expected 'owner/repo'." }, { status: 400 });
  }

  await registerRepo(repo);

  return jsonResponse({ ok: true, repo }, { status: 201 });
}

async function handleUnregisterRepo(repo: string): Promise<Response> {
  if (!isValidRepo(repo)) {
    return jsonResponse({ error: "Invalid repository format." }, { status: 400 });
  }

  await unregisterRepo(repo);
  await clearRepoReleases(repo);

  return jsonResponse({ ok: true, repo });
}