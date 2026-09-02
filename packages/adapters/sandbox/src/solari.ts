import { createRequire } from "node:module";
import { SolariClient } from "@solarisdk/sdk";
import {
  PhaseTimer,
  type SandboxProviderAdapter,
} from "@agentbench/core";

/**
 * Solari sandbox adapter.
 *
 * Cookbook-encoded gotchas honored: commands are NOT shell-interpreted
 * (argv in args); kill() destroys the VM while close() only drops the
 * local control channel; timeoutMs is a rolling idle window.
 */
export class SolariSandboxProvider implements SandboxProviderAdapter {
  readonly name = "solari";
  readonly primitive = "sandbox" as const;
  private client: SolariClient | null = null;

  availability() {
    const missing = process.env.SOLARI_API_KEY ? [] : ["SOLARI_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta() {
    return {
      sdk: "@solarisdk/sdk",
      sdk_version: sdkVersion("@solarisdk/sdk"),
      plan_tier: process.env.SOLARI_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): SolariClient {
    this.client ??= new SolariClient({ apiKey: process.env.SOLARI_API_KEY as string });
    return this.client;
  }

  async runCycle(): ReturnType<SandboxProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let sandbox: { kill: () => Promise<unknown> } | null = null;

    try {
      const pt = this.getClient();

      timer.begin("create");
      sandbox = (await pt.sandboxes.create({
        template: "base",
        timeoutMs: 2 * 60_000,
      })) as unknown as { kill: () => Promise<unknown> };
      timer.end("create");

      const withCommands = sandbox as unknown as {
        connect: () => Promise<unknown>;
        commands: {
          run: (
            cmd: string,
            opts?: { args?: string[] }
          ) => Promise<{ exitCode: number; stdout: string }>;
        };
      };

      timer.begin("first_exec");
      await withCommands.connect();
      await withCommands.commands.run("node", { args: ["-e", "process.stdout.write('ok')"] });
      timer.end("first_exec");

      timer.begin("exec_overhead");
      await withCommands.commands.run("node", { args: ["-e", "process.stdout.write('ok')"] });
      timer.end("exec_overhead");

      timer.begin("filesystem_write_1mb");
      const payload = "x".repeat(1024 * 1024);
      const withFiles = sandbox as unknown as {
        files: { write: (path: string, data: string) => Promise<unknown> };
      };
      await withFiles.files.write("/tmp/bench-1mb.txt", payload);
      timer.end("filesystem_write_1mb");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (sandbox) {
        timer.begin("teardown");
        try {
          await sandbox.kill(); // kill(), not close() — see cookbook gotchas
        } catch (e) {
          error ??= e instanceof Error ? e.message : String(e);
        }
        timer.end("teardown");
      }
    }

    return {
      phases: timer.snapshot(),
      providerMeta: this.meta(),
      ...(error !== undefined ? { error } : {}),
    };
  }

  async dispose(): Promise<void> {
    // SolariClient (aggregate SDK) holds no local proxy handle; only the
    // browser SDK client needs close(). Nothing to release here.
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
