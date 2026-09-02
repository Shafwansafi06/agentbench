import type { PWPageLike } from "./pwtypes.js";
import { errorMessage } from "./pwtypes.js";
import { evaluateStealth, type StealthChecks } from "./stealth.js";

export interface StealthCycleResult {
  checks: StealthChecks;
  error?: string;
}

export interface StealthSessionSteps {
  /** create session, connect, acquire page. cleanup releases everything. */
  create(): Promise<{ page: PWPageLike; cleanup: () => Promise<void> }>;
}

/**
 * Stealth gauntlet lifecycle: same shape as a latency cycle (create →
 * connect → evaluate → teardown) but the payload is the check battery, not
 * a navigation. No third-party sites — the checks are self-contained.
 */
export async function runStealthWithSteps(
  steps: StealthSessionSteps
): Promise<StealthCycleResult> {
  let page: PWPageLike | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let error: string | undefined;
  let checks: StealthChecks | undefined;

  try {
    const opened = await steps.create();
    page = opened.page;
    cleanup = opened.cleanup;
    checks = await evaluateStealth(page);
  } catch (e) {
    error = errorMessage(e);
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (e) {
        error ??= errorMessage(e);
      }
    }
  }

  return {
    checks: checks ?? {
      webdriver_leak: false,
      languages_present: false,
      plugins_present: false,
      chrome_object: false,
      permissions_consistent: false,
      webgl_gpu: false,
      ua_platform_consistent: false,
    },
    ...(error !== undefined ? { error } : {}),
  };
}
