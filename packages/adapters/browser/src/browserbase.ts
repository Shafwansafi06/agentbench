import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser as PWBrowser, type Page as PWPage } from "playwright-core";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage } from "./pwtypes.js";
import { sdkVersion } from "./solari.js";

/**
 * Browserbase adapter.
 *
 * Unlike Solari, session creation (REST) and CDP attach are separate calls,
 * so `session_create` and `cdp_connect` are measured as distinct phases.
 * `cdp_connect` includes connectOverCDP + page acquisition, matching the
 * other adapters' surface.
 */
export class BrowserbaseProvider implements BrowserProviderAdapter {
  readonly name = "browserbase";
  readonly primitive = "browser" as const;
  private client: Browserbase | null = null;

  availability() {
    const missing: string[] = [];
    if (!process.env.BROWSERBASE_API_KEY) missing.push("BROWSERBASE_API_KEY");
    if (!process.env.BROWSERBASE_PROJECT_ID) missing.push("BROWSERBASE_PROJECT_ID");
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "@browserbasehq/sdk",
      sdk_version: sdkVersion("@browserbasehq/sdk"),
      plan_tier: process.env.BROWSERBASE_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Browserbase {
    this.client ??= new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY as string,
    });
    return this.client;
  }

  async runCycle(url: string): ReturnType<BrowserProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let browser: PWBrowser | null = null;
    let sessionId: string | undefined;

    try {
      const bb = this.getClient();
      const projectId = process.env.BROWSERBASE_PROJECT_ID as string;

      timer.begin("session_create");
      const session = (await bb.sessions.create({ projectId })) as {
        id?: string;
        connectUrl?: string;
        connect_url?: string;
      };
      timer.end("session_create");

      sessionId = session.id;
      const connectUrl = session.connectUrl ?? session.connect_url;
      if (!connectUrl) {
        throw new Error(
          "Browserbase session response contained no connect URL — SDK shape may have changed"
        );
      }

      timer.begin("cdp_connect");
      const pwBrowser = await chromium.connectOverCDP(connectUrl, { timeout: 30_000 });
      const context = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
      const page: PWPage = await context.newPage();
      browser = pwBrowser;
      timer.end("cdp_connect");

      timer.begin("first_navigation");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      timer.end("first_navigation");
    } catch (e) {
      error = errorMessage(e);
    } finally {
      if (browser) {
        timer.begin("teardown");
        try {
          await browser.close(); // drops the CDP connection
        } catch (e) {
          error ??= errorMessage(e);
        }
        timer.end("teardown");
        // Best-effort explicit release; the SDK method may not exist in
        // every version. Never masks the cycle's own result.
        if (sessionId) {
          try {
            const bb = this.getClient();
            await (bb.sessions as unknown as {
              update: (id: string, body: { status: string }) => Promise<unknown>;
            }).update(sessionId, { status: "REQUEST_RELEASE" });
          } catch {
            // release is best-effort; session expires server-side anyway
          }
        }
      }
    }

    return {
      phases: timer.snapshot(),
      fusedPhases: [],
      providerMeta: this.meta(),
      ...(error !== undefined ? { error } : {}),
    };
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}
