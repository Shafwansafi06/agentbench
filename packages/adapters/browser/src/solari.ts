import { createRequire } from "node:module";
import { Solari } from "@solarisdk/browser";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage, extractNavBreakdown, type PWBrowserLike, type PWPageLike } from "./pwtypes.js";

/**
 * Solari cloud browser adapter.
 *
 * NOTE on fused phases: `solari.launch()` creates the session AND connects
 * CDP inside one call. The two boundaries are not separately observable, so
 * `cdp_connect` is recorded as fused with `session_create`. `cdp_connect`
 * here covers page acquisition (newPage) only — same surface as the
 * Browserbase adapter (connectOverCDP + newPage), so the phases remain
 * comparable across providers.
 *
 * The Solari client keeps a loopback proxy open for connection retries; it
 * is created once per run and closed in dispose(), never per cycle.
 * `browser.close()` releases the remote session slot every cycle.
 */
export class SolariBrowserProvider implements BrowserProviderAdapter {
  readonly name = "solari";
  readonly primitive = "browser" as const;
  private client: Solari | null = null;

  availability() {
    const missing = process.env.SOLARI_API_KEY ? [] : ["SOLARI_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta(): ProviderMeta {
    return {
      sdk: "@solarisdk/browser",
      sdk_version: sdkVersion("@solarisdk/browser"),
      plan_tier: process.env.SOLARI_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Solari {
    this.client ??= new Solari({ apiKey: process.env.SOLARI_API_KEY as string });
    return this.client;
  }

  async runCycle(url: string): ReturnType<BrowserProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    const fusedPhases: string[] = [];
    let error: string | undefined;
    let navBreakdown: Record<string, number> | undefined;
    let browser: PWBrowserLike | null = null;
    let page: PWPageLike | null = null;

    try {
      const solari = this.getClient();
      timer.begin("session_create");
      // launch() fuses create + connect; boundary not separately observable.
      const launched = await solari.launch();
      timer.end("session_create");
      fusedPhases.push("cdp_connect");

      timer.begin("cdp_connect"); // page acquisition only — see class doc
      browser = launched as unknown as PWBrowserLike;
      page = await browser.newPage();
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
      }
    }

    return {
      phases: timer.snapshot(),
      fusedPhases,
      providerMeta: this.meta(),
      ...(navBreakdown !== undefined ? { navBreakdown } : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }

  async dispose(): Promise<void> {
    await this.client?.close().catch(() => {});
    this.client = null;
  }
}

export function sdkVersion(pkg: string): string {
  try {
    const req = createRequire(import.meta.url);
    return (req(`${pkg}/package.json`) as { version: string }).version;
  } catch {
    return "unknown";
  }
}
