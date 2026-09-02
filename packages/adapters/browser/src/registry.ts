import type { BrowserProviderAdapter } from "@agentbench/core";
import { SolariBrowserProvider } from "./solari.js";
import { BrowserbaseProvider } from "./browserbase.js";

/**
 * Registry of built-in browser providers. Adding a provider = implementing
 * BrowserProviderAdapter + one line here. Target: a stranger can add a
 * provider in under 30 minutes (see CONTRIBUTING notes in README).
 */
export const BROWSER_PROVIDERS: BrowserProviderAdapter[] = [
  new SolariBrowserProvider(),
  new BrowserbaseProvider(),
];

export function resolveProviders(names: string[]): {
  providers: BrowserProviderAdapter[];
  unknown: string[];
  unavailable: { name: string; missing: string[] }[];
} {
  const unknown: string[] = [];
  const unavailable: { name: string; missing: string[] }[] = [];
  const providers: BrowserProviderAdapter[] = [];

  for (const name of names) {
    const found = BROWSER_PROVIDERS.find((p) => p.name === name);
    if (!found) {
      unknown.push(name);
      continue;
    }
    const status = found.availability();
    if (status.available) providers.push(found);
    else unavailable.push({ name: found.name, missing: status.missing });
  }

  return { providers, unknown, unavailable };
}

export { SolariBrowserProvider, BrowserbaseProvider };
