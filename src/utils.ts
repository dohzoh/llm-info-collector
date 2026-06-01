/**
 * Parse a GitHub "owner/repo" string into its components.
 */
export function parseRepoKey(repo: string): { owner: string; repo: string } | null {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Validate that a string is a non-empty, properly formatted "owner/repo".
 */
export function isValidRepo(repo: string): boolean {
  return parseRepoKey(repo) !== null;
}

/**
 * Build the GitHub Atom RSS feed URL for a repository.
 */
export function buildAtomFeedUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/releases.atom`;
}

/**
 * Clamp a limit to the allowed range.
 */
export function clampLimit(limit: number | undefined, min = 1, max = 100): number {
  if (limit === undefined) return min;
  return Math.max(min, Math.min(max, Math.floor(limit)));
}

/**
 * Parse an ISO 8601 date string; return null on invalid input.
 */
export function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Current Unix timestamp in seconds.
 */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * JSON response helper.
 */
export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}