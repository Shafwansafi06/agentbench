import Steel from "steel-sdk";
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
    let navBreakdown: Record<string, number> | undefined;
    let browser: PWBrowser | null = null;
    let page: PWPage | null = null;
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
      ...(navBreakdown !== undefined ? { navBreakdown } : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }


  async runStealthCycle(): Promise<StealthCycleResult> {
    return runStealthWithSteps({
      create: async () => {
        const steel = this.getClient();
        const session = (await steel.sessions.create()) as unknown;
        const connectUrl = cdpUrlOf(session, "steel");
        const pwBrowser = await chromium.connectOverCDP(connectUrl, { timeout: 30_000 });
        const context = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
        const page = await context.newPage();
        const sessionId = idOf(session);
        return {
          page,
          cleanup: async () => {
            await pwBrowser.close();
            if (sessionId) {
              try {
                await (steel.sessions as unknown as { release: (id: string) => Promise<unknown> }).release(sessionId);
              } catch { /* best-effort */ }
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
