export interface Release {
  id: string;
  repo: string;
  tag: string;
  name: string;
  url: string;
  published: string;
  body: string;
  collected_at: number;
}

export interface ReleasesResponse {
  repo: string;
  releases: Omit<Release, "repo" | "collected_at">[];
  total: number;
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export interface RepoRecord {
  repo: string;
  added_at: number;
}