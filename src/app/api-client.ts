/** What an API call came back with: the body of a 2xx, or a refusal's error code (and its body). */
export type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string; body: unknown };

/**
 * Call one of the app's API routes: GET without a body, POST (JSON) with one, never cached.
 * Every route answers a refusal with `{ ok: false, error }` (e.g. 400 bad-request, 404
 * archive-unavailable), which resolves as `{ ok: false, error }` rather than throwing.
 * Rejects only when the network fails or the response isn't JSON.
 */
export async function apiJson<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json: unknown = await res.json();
  if (res.ok) return { ok: true, status: res.status, body: json as T };
  const error =
    typeof json === "object" && json !== null && "error" in json && typeof json.error === "string"
      ? json.error
      : `http-${res.status}`;
  return { ok: false, status: res.status, error, body: json };
}
