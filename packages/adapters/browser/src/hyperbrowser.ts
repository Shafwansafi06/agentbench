import { Hyperbrowser } from "@hyperbrowser/sdk";
import { chromium, type Browser as PWBrowser, type Page as PWPage } from "playwright-core";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage, extractNavBreakdown } from "./pwtypes.js";
import { runStealthWithSteps, type StealthCycleResult } from "./stealth-helpers.js";
import { sdkVersion } from "./solari.js";
import { cdpUrlOf, idOf } from "./sdk-shapes.js";

/**
 * Hyperbrowser adapter.
 *
 * API confirmed from the official node-sdk README: sessions.create() →
 * session.wsEndpoint → connectOverCDP; sessions.stop(id) to release.
 */
export class HyperbrowserProvider implements BrowserProviderAdapter {
  readonly name = "hyperbrowser";
  readonly primitive = "browser" as const;
  private client: Hyperbrowser | null = null;

  availability() {
    const missing = process.env.HYPERBROWSER_API_KEY ? [] : ["HYPERBROWSER_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "@hyperbrowser/sdk",
      sdk_version: sdkVersion("@hyperbrowser/sdk"),
      plan_tier: process.env.HYPERBROWSER_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Hyperbrowser {
    this.client ??= new Hyperbrowser({
      apiKey: process.env.HYPERBROWSER_API_KEY as string,
    });
    return this.client;
  }

  async runCycle(url: string): ReturnType<BrowserProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let navBreakdown: Record<string, number> | undefined;
    let browser: PWBrowser | null = null;
    let page: PWPage | null = null;
    let sessionId: string | undefined;

    try {
      const hb = this.getClient();

      timer.begin("session_create");
      const session = (await hb.sessions.create()) as unknown;
      timer.end("session_create");

      sessionId = idOf(session);
      const connectUrl = cdpUrlOf(session, "hyperbrowser");

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

        if (sessionId) {
          try {
            await this.getClient().sessions.stop(sessionId);
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


  async runStealthCycle(): Promise<StealthCycleResult> {
    return runStealthWithSteps({
      create: async () => {
        const hb = this.getClient();
        const session = (await hb.sessions.create()) as unknown;
        const connectUrl = cdpUrlOf(session, "hyperbrowser");
        const pwBrowser = await chromium.connectOverCDP(connectUrl, { timeout: 30_000 });
        const context = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
        const page = await context.newPage();
        const sessionId = idOf(session);
        return {
          page,
          cleanup: async () => {
            await pwBrowser.close();
            if (sessionId) {
              try { await hb.sessions.stop(sessionId); } catch { /* best-effort */ }
            }
          },
        };
      },
    });
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}
