import { buildAtomFeedUrl } from "./utils";
import type { Release } from "./types";

/**
 * Fetch the GitHub Atom RSS feed for a repository.
 * Throws on HTTP error.
 */
export async function fetchAtomFeed(owner: string, repo: string): Promise<string> {
  const url = buildAtomFeedUrl(owner, repo);
  const res = await fetch(url, {
    headers: {
      Accept: "application/atom+xml",
      "User-Agent": "github-release-rss-collector/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Atom feed for ${owner}/${repo}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/**
 * Parse an Atom RSS feed string into Release objects.
 */
export function parseAtomFeed(xml: string, repo: string): Release[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  // Check for parse error
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`XML parse error for ${repo}: ${parseError.textContent?.slice(0, 200)}`);
  }

  const entries = Array.from(doc.querySelectorAll("entry"));
  const releases: Release[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (const entry of entries) {
    const idEl = entry.querySelector("id");
    const titleEl = entry.querySelector("title");
    const publishedEl = entry.querySelector("published");
    const updatedEl = entry.querySelector("updated");
    const contentEl = entry.querySelector("content");
    const linkEl = entry.querySelector('link[rel="alternate"]');

    const id = idEl?.textContent?.trim() ?? "";
    const name = titleEl?.textContent?.trim() ?? "";
    const published = (publishedEl ?? updatedEl)?.textContent?.trim() ?? "";
    const body = contentEl?.innerHTML ?? contentEl?.textContent ?? "";
    const url = linkEl?.getAttribute("href") ?? "";

    // Extract tag from the URL (e.g., .../releases/tag/v2.0.0)
    const tag = extractTagFromUrl(url) ?? name;

    if (!id || !name) continue;

    releases.push({
      id,
      repo,
      tag,
      name,
      url,
      published,
      body,
      collected_at: nowSec,
    });
  }

  return releases;
}

function extractTagFromUrl(url: string): string | null {
  const match = url.match(/\/releases\/tag\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetch and parse in one call.
 */
export async function fetchReleases(owner: string, repo: string): Promise<Release[]> {
  const xml = await fetchAtomFeed(owner, repo);
  return parseAtomFeed(xml, `${owner}/${repo}`);
}