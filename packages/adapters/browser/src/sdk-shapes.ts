/**
 * Defensive field extraction across SDK response shapes.
 *
 * SDK response fields drift between versions (camelCase vs snake_case,
 * renamed fields on major bumps). Adapters probe a list of known field
 * names and fail loudly with the tried keys when none match — so a
 * provider's SDK change surfaces as a benchmark finding, not a mystery.
 */
export function pickField(obj: unknown, ...keys: string[]): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/** Extract a CDP websocket URL from any session-shaped response. */
export function cdpUrlOf(
  session: unknown,
  provider: string
): string {
  const url = pickField(
    session,
    "wsEndpoint",
    "ws_endpoint",
    "websocketUrl",
    "websocket_url",
    "cdpUrl",
    "cdp_url",
    "cdp_ws_url",
    "connectUrl",
    "connect_url"
  );
  if (!url) {
    throw new Error(
      `${provider}: no CDP URL in session response (probed wsEndpoint/ws_endpoint/websocketUrl/websocket_url/cdpUrl/cdp_url/connectUrl/connect_url) — SDK shape changed, document it in the README`
    );
  }
  return url;
}

/** Extract a session id from any session-shaped response. */
export function idOf(session: unknown): string | undefined {
  return pickField(session, "id", "session_id", "sessionId");
}
