/**
 * Minimal structural types for the Playwright surface adapters rely on.
 * Structural on purpose: provider SDKs ship their own (sometimes re-bundled)
 * Playwright typings and exact-version matching is a losing game.
 */
export interface PWPageLike {
  goto(
    url: string,
    opts?: { waitUntil?: string; timeout?: number }
  ): Promise<unknown>;
}

export interface PWBrowserLike {
  newPage(): Promise<PWPageLike>;
  close(): Promise<void>;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
