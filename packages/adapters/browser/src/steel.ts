import Steel from "steel-sdk";
import { chromium, type Browser as PWBrowser, type Page as PWPage } from "playwright-core";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage } from "./pwtypes.js";
import { sdkVersion } from "./solari.js";
import { cdpUrlOf, idOf } from "./sdk-shapes.js";

/**
 * Steel adapter.
 *
 * Phase surface matches the other split adapters: REST session create,
 * then connectOverCDP + page acquisition as `cdp_connect`.
 */
export class SteelProvider implements BrowserProviderAdapter {
  readonly name = "steel";
  readonly primitive = "browser" as const;
  private client: Steel | null = null;

  availability() {
    const missing = process.env.STEEL_API_KEY ? [] : ["STEEL_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "steel-sdk",
      sdk_version: sdkVersion("steel-sdk"),
      plan_tier: process.env.STEEL_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Steel {
    this.client ??= new Steel({
      steelAPIKey: process.env.STEEL_API_KEY as string,
    });
    return this.client;
  }

  async runCycle(url: string): ReturnType<BrowserProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let browser: PWBrowser | null = null;
    let sessionId: string | undefined;

    try {
      const steel = this.getClient();

      timer.begin("session_create");
      const session = (await steel.sessions.create()) as unknown;
      timer.end("session_create");

      sessionId = idOf(session);
      const connectUrl = cdpUrlOf(session, "steel");

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
          await browser.close();
        } catch (e) {
          error ??= errorMessage(e);
        }
        timer.end("teardown");

        // Best-effort release so free-tier session slots free up immediately.
        if (sessionId) {
          try {
            const steel = this.getClient();
            const sessions = steel.sessions as unknown as {
              release: (id: string) => Promise<unknown>;
            };
            await sessions.release(sessionId);
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
      ...(error !== undefined ? { error } : {}),
    };
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}
