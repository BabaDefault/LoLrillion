/** A request limit: at most `requests` per rolling `perMs` window. */
export interface RateLimit {
  requests: number;
  perMs: number;
}

/** Development-key app limits. Riot applies them per routing host (each platform and region separately). */
export const DEV_KEY_LIMITS: readonly RateLimit[] = [
  { requests: 20, perMs: 1_000 },
  { requests: 100, perMs: 120_000 },
];

export interface RiotClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Per-host limits. Default: development-key limits. A personal/production key can raise them. */
  limits?: readonly RateLimit[];
  /** Retries after a 429 or 5xx before giving up. Default 5. */
  maxRetries?: number;
  /** First backoff when the server gives no Retry-After; doubles each retry. Default 1000ms. */
  baseBackoffMs?: number;
}

export interface RiotClient {
  /** GET `https://<host><path>`. Resolves to the JSON body, or `null` when Riot answers 404. */
  get(host: string, path: string): Promise<unknown>;
}

/**
 * A minimal Riot API client: per-host rate limiting (rolling windows), Retry-After on 429,
 * exponential backoff on 429-without-Retry-After and 5xx. Concurrent calls to one host are queued.
 */
export function createRiotClient(options: RiotClientOptions): RiotClient {
  const {
    apiKey,
    fetch: doFetch = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    limits = DEV_KEY_LIMITS,
    maxRetries = 5,
    baseBackoffMs = 1_000,
  } = options;

  const sent = new Map<string, number[]>();
  const queues = new Map<string, Promise<void>>();

  /** Waits until a request to `host` fits every limit, then records it. */
  function takeSlot(host: string): Promise<void> {
    const turn = (queues.get(host) ?? Promise.resolve()).then(async () => {
      const times = sent.get(host) ?? [];
      sent.set(host, times);
      for (;;) {
        const t = now();
        let waitMs = 0;
        for (const { requests, perMs } of limits) {
          const inWindow = times.filter((s) => s > t - perMs);
          if (inWindow.length >= requests) {
            waitMs = Math.max(waitMs, inWindow[inWindow.length - requests] + perMs - t);
          }
        }
        if (waitMs <= 0) break;
        await sleep(waitMs);
      }
      times.push(now());
      const longest = Math.max(...limits.map((l) => l.perMs));
      while (times.length > 0 && times[0] <= now() - longest) times.shift();
    });
    queues.set(host, turn.catch(() => {}));
    return turn;
  }

  return {
    async get(host, path) {
      const url = `https://${host}${path}`;
      for (let attempt = 0; ; attempt++) {
        await takeSlot(host);
        const res = await doFetch(url, { headers: { "X-Riot-Token": apiKey } });
        if (res.ok) return res.json();
        if (res.status === 404) return null;
        if (res.status === 401 || res.status === 403) {
          throw new Error(`GET ${url} -> ${res.status}: check RIOT_API_KEY (development keys expire every 24h)`);
        }
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= maxRetries) throw new Error(`GET ${url} -> ${res.status}`);
        const retryAfter = Number(res.headers.get("Retry-After"));
        await sleep(
          res.status === 429 && retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt,
        );
      }
    },
  };
}
