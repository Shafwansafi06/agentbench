import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/** Append one JSON line. Creates parent dirs. Synchronous: crash-safe. */
export function appendJSONL(filePath: string, record: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
}

export function readJSONL<T>(filePath: string): T[] {
  const raw = readFileSync(filePath, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}
