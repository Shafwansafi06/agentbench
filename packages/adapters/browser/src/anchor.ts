import { Sessions } from "anchorbrowser";
import { chromium, type Browser as PWBrowser, type Page as PWPage } from "playwright-core";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage, extractNavBreakdown } from "./pwtypes.js";
import { sdkVersion } from "./solari.js";
import { cdpUrlOf, idOf } from "./sdk-shapes.js";

/**
 * Anchor adapter.
 *
 * Uses the SDK's static resource classes directly (v1 style):
 * `Sessions.createSession()` → `{ data: session }` → CDP connect.
 * The `createBrowser()` Playwright helper fuses create+connect, which would
 * destroy phase comparability, so it is deliberately not used.
 * Auth is read from ANCHORBROWSER_API_KEY by the SDK by default.
 */
export class AnchorProvider implements BrowserProviderAdapter {
  readonly name = "anchor";
  readonly primitive = "browser" as const;
  private configured = false;

  availability() {
    const missing = process.env.ANCHORBROWSER_API_KEY ? [] : ["ANCHORBROWSER_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "anchorbrowser",
      sdk_version: sdkVersion("anchorbrowser"),
      plan_tier: process.env.ANCHOR_PLAN_TIER ?? "undisclosed",
    };
  }

  private ensureClient(): void {
    if (this.configured) return;
    const authKey = process.env.ANCHORBROWSER_API_KEY as string;
    const client = (Sessions as unknown as {
      getConfig: () => { auth?: () => string | undefined };
    });
    const current = typeof client.getConfig === "function" ? client.getConfig() : undefined;
    if (!current?.auth) {
      // SDK reads ANCHORBROWSER_API_KEY itself; set config only if absent.
      if (current && typeof current.auth !== "function") {
        (Sessions as unknown as {
          setConfig: (cfg: { auth: () => string }) => void;
        }).setConfig({ auth: () => authKey });
      }
    }
    this.configured = true;
  }

  async runCycle(url: string): ReturnType<BrowserProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let navBreakdown: Record<string, number> | undefined;
    let browser: PWBrowser | null = null;
    let page: PWPage | null = null;
    let sessionId: string | undefined;

    try {
      this.ensureClient();

      timer.begin("session_create");
      const response = (await Sessions.createSession({
        body: { session: { recording: { active: false } } },
      } as Parameters<typeof Sessions.createSession>[0])) as { data?: unknown } & unknown;
      timer.end("session_create");

      const session = response?.data ?? response;
      sessionId = idOf(session);
      const connectUrl = cdpUrlOf(session, "anchor");

      timer.begin("cdp_connect");
      const pwBrowser = await chromium.connectOverCDP(connectUrl, { timeout: 30_000 });
      const context = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
      page = await context.newPage();
      browser = pwBrowser;
      timer.end("cdp_connect");

      timer.begin("first_navigation");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      timer.end("first_navigation");
    } catch (e) {
      error = errorMessage(e);
    } finally {
      if (page) navBreakdown = await extractNavBreakdown(page);
      if (browser) {
        timer.begin("teardown");
        try {
          await browser.close();
        } catch (e) {
          error ??= errorMessage(e);
        }
        timer.end("teardown");

        // Best-effort explicit delete so the free-tier slot frees up now.
        if (sessionId) {
          try {
            const sessions = Sessions as unknown as {
              deleteSession: (opts: { path: { sessionId: string } }) => Promise<unknown>;
            };
            await sessions.deleteSession({ path: { sessionId } });
          } catch {
            // session expires server-side anyway
          }
        }
      }
    }

    return {
      phases: timer.snapshot(),
      fusedPhases: [],
      providerMeta: this.meta(),
      ...(navBreakdown !== undefined ? { navBreakdown } : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }

  async dispose(): Promise<void> {
    this.configured = false;
  }
}
