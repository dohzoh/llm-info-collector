/// <reference types="@cloudflare/workers-types" />

// Workers KV binding injected by the runtime
declare const RELEASES: KVNamespace;

/** Env shape provided to the Worker at runtime. */
interface Env {
  RELEASES: KVNamespace;
}