import type { Release } from "./types";

/**
 * KV key prefixes.
 */
const RELEASE_PREFIX = "releases:";
const REPO_LIST_KEY = "registered_repos";

/** Build the key for a single release entry. */
function releaseKey(repo: string, releaseId: string): string {
  return `${RELEASE_PREFIX}${repo}:${releaseId}`;
}

/**
 * List all release keys for a repo (by scanning with prefix).
 * Note: In Workers, KV list() is only available in Durable Objects / Workers,
 * but here we use direct gets with a known pattern.
 * For querying, we store a secondary index per repo.
 */
function repoReleasesIndexKey(repo: string): string {
  return `${RELEASE_PREFIX}${repo}:__index__`;
}

/**
 * Store a release in KV. Uses a per-repo index to allow listing.
 */
export async function storeRelease(release: Release): Promise<void> {
  const key = releaseKey(release.repo, release.id);
  await RELEASES.put(key, JSON.stringify(release));

  // Add to per-repo sorted index (stored as newline-separated release IDs, newest first)
  const indexKey = repoReleasesIndexKey(release.repo);
  const existing = await RELEASES.get(indexKey, "text");

  const existingIds = existing ? new Set(existing.split("\n").filter(Boolean)) : new Set<string>();
  existingIds.add(release.id);

  // Keep newest 100 entries to avoid unbounded growth
  const sorted = [...existingIds].slice(0, 100);
  await RELEASES.put(indexKey, sorted.join("\n"));
}

/**
 * Store multiple releases in parallel.
 */
export async function storeReleases(releases: Release[]): Promise<void> {
  if (releases.length === 0) return;
  await Promise.all(releases.map((r) => storeRelease(r)));
}

/**
 * Retrieve releases for a repo, optionally filtered by `since` (ISO 8601).
 */
export async function getReleases(
  repo: string,
  options: { limit?: number; since?: string } = {}
): Promise<Omit<Release, "repo" | "collected_at">[]> {
  const indexKey = repoReleasesIndexKey(repo);
  const indexStr = await RELEASES.get(indexKey, "text");

  if (!indexStr) return [];

  const releaseIds = indexStr.split("\n").filter(Boolean);
  if (releaseIds.length === 0) return [];

  const limit = options.limit ?? 20;
  const sinceDate = options.since ? new Date(options.since) : null;

  // Fetch all releases (we have at most 100 per repo)
  const releases = await Promise.all(
    releaseIds.map((id) =>
      RELEASES.get(releaseKey(repo, id), "json").then((r) => r as Release | null)
    )
  );

  const valid = releases.filter((r): r is Release => r !== null);

  // Sort by collected_at descending (most recent first)
  valid.sort((a, b) => b.collected_at - a.collected_at);

  // Apply `since` filter
  const filtered = sinceDate
    ? valid.filter((r) => new Date(r.published) >= sinceDate)
    : valid;

  return filtered.slice(0, limit).map((r) => ({
    id: r.id,
    tag: r.tag,
    name: r.name,
    url: r.url,
    published: r.published,
    body: r.body,
  }));
}

/**
 * Register a repository for tracking.
 */
export async function registerRepo(repo: string): Promise<void> {
  const repos = await listRegisteredRepos();
  if (!repos.includes(repo)) {
    repos.push(repo);
    await RELEASES.put(REPO_LIST_KEY, JSON.stringify(repos));
  }
}

/**
 * Unregister a repository.
 */
export async function unregisterRepo(repo: string): Promise<void> {
  const repos = await listRegisteredRepos();
  const updated = repos.filter((r) => r !== repo);
  await RELEASES.put(REPO_LIST_KEY, JSON.stringify(updated));
}

/**
 * List all registered repository "owner/repo" strings.
 */
export async function listRegisteredRepos(): Promise<string[]> {
  const raw = await RELEASES.get(REPO_LIST_KEY, "text");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Delete a single release by repo + id.
 */
export async function deleteRelease(repo: string, releaseId: string): Promise<void> {
  await RELEASES.delete(releaseKey(repo, releaseId));
}

/**
 * Clear all releases for a repo (used when unregistering).
 */
export async function clearRepoReleases(repo: string): Promise<void> {
  const indexKey = repoReleasesIndexKey(repo);
  const indexStr = await RELEASES.get(indexKey, "text");
  if (!indexStr) return;

  const ids = indexStr.split("\n").filter(Boolean);
  await Promise.all(ids.map((id) => RELEASES.delete(releaseKey(repo, id))));
  await RELEASES.delete(indexKey);
}