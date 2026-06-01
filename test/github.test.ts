import { describe, it, expect } from "vitest";
import { parseAtomFeed } from "../src/github";

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>vercel/next.js Releases</title>
  <entry>
    <id>tag:github.com,2008:/releases/repo/145601234</id>
    <title>Next.js 15.0.0</title>
    <published>2025-10-01T00:00:00Z</published>
    <updated>2025-10-01T01:00:00Z</updated>
    <link rel="alternate" href="https://github.com/vercel/next.js/releases/tag/v15.0.0"/>
    <content type="html"><h1>Release Notes</h1><p>New features and improvements.</p></content>
  </entry>
  <entry>
    <id>tag:github.com,2008:/releases/repo/145601233</id>
    <title>Next.js 14.2.0</title>
    <published>2025-09-15T10:30:00Z</published>
    <updated>2025-09-15T11:00:00Z</updated>
    <link rel="alternate" href="https://github.com/vercel/next.js/releases/tag/v14.2.0"/>
    <content type="html"><p>Bug fixes.</p></content>
  </entry>
  <entry>
    <id>tag:github.com,2008:/releases/repo/145601232</id>
    <title>Next.js 14.1.0</title>
    <updated>2025-08-20T08:00:00Z</updated>
    <link rel="alternate" href="https://github.com/vercel/next.js/releases/tag/v14.1.0"/>
  </entry>
</feed>`;

describe("parseAtomFeed", () => {
  it("parses all fields correctly", () => {
    const releases = parseAtomFeed(SAMPLE_ATOM, "vercel/next.js");
    expect(releases).toHaveLength(3);
  });

  it("extracts id, name, tag, url, published, body", () => {
    const releases = parseAtomFeed(SAMPLE_ATOM, "vercel/next.js");

    const r = releases[0];
    expect(r.id).toBe("tag:github.com,2008:/releases/repo/145601234");
    expect(r.repo).toBe("vercel/next.js");
    expect(r.name).toBe("Next.js 15.0.0");
    expect(r.tag).toBe("v15.0.0");
    expect(r.url).toBe("https://github.com/vercel/next.js/releases/tag/v15.0.0");
    expect(r.published).toBe("2025-10-01T00:00:00Z");
    expect(r.body).toBe("<h1>Release Notes</h1><p>New features and improvements.</p>");
    expect(r.collected_at).toBeGreaterThan(0);
  });

  it("falls back to updated when published is missing", () => {
    const releases = parseAtomFeed(SAMPLE_ATOM, "vercel/next.js");
    const r = releases[2];
    expect(r.published).toBe("2025-08-20T08:00:00Z");
    expect(r.body).toBe("");
  });
  it("skips entries without id or name", () => {
    const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>No ID entry</title>
    <link rel="alternate" href="https://github.com/example/repo/releases/tag/v1.0.0"/>
  </entry>
</feed>`;
    const releases = parseAtomFeed(invalidXml, "example/repo");
    expect(releases).toHaveLength(0);
  });

  it("throws on malformed XML", () => {
    expect(() => parseAtomFeed("<not-valid-xml", "example/repo")).toThrow("XML parse error");
  });

  it("decodes URL-encoded tags", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>123</id>
    <title>Release</title>
    <published>2025-01-01T00:00:00Z</published>
    <link rel="alternate" href="https://github.com/example/repo/releases/tag/v1.0%2Bbuild"/>
  </entry>
</feed>`;
    const releases = parseAtomFeed(xml, "example/repo");
    expect(releases[0].tag).toBe("v1.0+build");
  });
});