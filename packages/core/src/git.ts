import { execSync } from "node:child_process";

let cachedGitHash: string | undefined | null = null;

/** Short git hash of the harness, captured once per process. */
export function gitHash(): string | undefined {
  if (cachedGitHash === null) {
    try {
      cachedGitHash = execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      cachedGitHash = undefined;
    }
  }
  return cachedGitHash;
}
