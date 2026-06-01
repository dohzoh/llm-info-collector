import { fetchReleases } from "./github";
import { listRegisteredRepos, storeReleases } from "./kv";
import { isValidRepo } from "./utils";

/**
 * Cron trigger handler — runs every hour.
 * Fetches the latest release for all registered repositories.
 */
export async function scheduled(): Promise<void> {
  const repos = await listRegisteredRepos();

  if (repos.length === 0) {
    console.log("No registered repos to fetch.");
    return;
  }

  console.log(`Fetching releases for ${repos.length} repository(ies): ${repos.join(", ")}`);

  const errors: { repo: string; error: string }[] = [];

  await Promise.allSettled(
    repos.map(async (repo) => {
      if (!isValidRepo(repo)) {
        errors.push({ repo, error: "Invalid repo format" });
        return;
      }

      const [owner, name] = repo.split("/");
      const releases = await fetchReleases(owner, name);
      await storeReleases(releases);
      console.log(`Stored ${releases.length} release(s) for ${repo}`);
    })
  );

  if (errors.length > 0) {
    console.error("Errors during fetch:", errors);
  }
}