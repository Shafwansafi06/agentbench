import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Solari } from "@solarisdk/browser";
import {
  PhaseTimer,
  type BrowserProviderAdapter,
  type ProviderMeta,
} from "@agentbench/core";
import { errorMessage, extractNavBreakdown, type PWBrowserLike, type PWPageLike } from "./pwtypes.js";
import { runStealthWithSteps, type StealthCycleResult } from "./stealth-helpers.js";

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


  async runStealthCycle(): Promise<StealthCycleResult> {
    return runStealthWithSteps({
      create: async () => {
        const solari = this.getClient();
        const launched = (await solari.launch()) as unknown as PWBrowserLike;
        return {
          page: await launched.newPage(),
          cleanup: async () => { await launched.close(); },
        };
      },
    });
  }

  async dispose(): Promise<void> {
    await this.client?.close().catch(() => {});
    this.client = null;
  }
}

export function sdkVersion(pkg: string): string {
  // createRequire + exports-restricted packages fail to resolve
  // `${pkg}/package.json`; walk node_modules upward instead.
  const here = dirname(fileURLToPath(import.meta.url));
  const segments = here.split(sep);
  for (let i = segments.length - 1; i > 0; i--) {
    const path = join(segments.slice(0, i).join(sep), "node_modules", pkg, "package.json");
    try {
      return (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version;
    } catch {
      continue;
    }
  }
  return "unknown";
}
