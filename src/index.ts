import { handleRequest } from "./api";
import { scheduled } from "./cron";

/**
 * HTTP request handler — routes to API handlers.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },

  /**
   * Cron trigger — scheduled collector.
   * Configured via wrangler.toml: triggers.crons = ["0 * * * *"]
   */
  async scheduled(_event: unknown, _env: unknown, _ctx: unknown): Promise<void> {
    await scheduled();
  },
} satisfies ExportedHandler<Env>;