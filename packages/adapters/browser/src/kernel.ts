import Kernel from "@onkernel/sdk";
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
 * Kernel adapter.
 *
 * `client.browsers.create()` returns a browser record with a CDP URL;
 * session creation (REST) and CDP attach are separate calls, so both
 * phases are measured distinctly.
 */
export class KernelProvider implements BrowserProviderAdapter {
  readonly name = "kernel";
  readonly primitive = "browser" as const;
  private client: Kernel | null = null;

  availability() {
    const missing = process.env.KERNEL_API_KEY ? [] : ["KERNEL_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "@onkernel/sdk",
      sdk_version: sdkVersion("@onkernel/sdk"),
      plan_tier: process.env.KERNEL_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Kernel {
    this.client ??= new Kernel({ apiKey: process.env.KERNEL_API_KEY as string });
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
      const kernel = this.getClient();

      timer.begin("session_create");
      const created = (await kernel.browsers.create()) as unknown;
      timer.end("session_create");

      sessionId = idOf(created);
      const connectUrl = cdpUrlOf(created, "kernel");
      if (!sessionId) {
        throw new Error("Kernel browser response contained no session id");
      }

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

        // Best-effort explicit release; Kernel bills per browser-second.
        if (sessionId) {
          try {
            const kernel = this.getClient();
            const browsers = kernel.browsers as unknown as {
              delete: (id: string) => Promise<unknown>;
            };
            await browsers.delete(sessionId);
          } catch {
            // release is best-effort; idle timeout reclaims it anyway
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
    this.client = null;
  }
}
