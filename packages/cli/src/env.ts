import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal .env loader. Real keys never override already-set process env. */
export function loadDotEnv(path = ".env"): string[] {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return [];
  }
  const loaded: string[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m as unknown as [string, string, string];
    const cleaned = value.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined && cleaned !== "") {
      process.env[key] = cleaned;
      loaded.push(key);
    }
  }
  return loaded;
}
