import { Daytona } from "@daytonaio/sdk";
import { PhaseTimer } from "@agentbench/core";
import type { SandboxProviderAdapter } from "@agentbench/core";
import { sdkVersion } from "./solari.js";

interface DaytonaSandboxShape {
  process: { executeCommand: (cmd: string) => Promise<{ result?: string; exitCode?: number }> };
  fs: { uploadFile: (file: Buffer, remotePath: string) => Promise<void> };
}

/**
 * Daytona adapter.
 *
 * API from @daytonaio/sdk esm typings v0.207: daytona.create() →
 * sandbox.process.executeCommand / sandbox.fs.uploadFile(Buffer, path) /
 * daytona.delete(sandbox). Commands here are shell strings per the SDK.
 */
export class DaytonaSandboxProvider implements SandboxProviderAdapter {  readonly name = "daytona";
  readonly primitive = "sandbox" as const;
  private client: Daytona | null = null;

  availability() {
    const missing = process.env.DAYTONA_API_KEY ? [] : ["DAYTONA_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta() {
    return {
      sdk: "@daytonaio/sdk",
      sdk_version: sdkVersion("@daytonaio/sdk"),
      plan_tier: process.env.DAYTONA_PLAN_TIER ?? "undisclosed",
    };
  }

  private getClient(): Daytona {
    this.client ??= new Daytona({ apiKey: process.env.DAYTONA_API_KEY as string });
    return this.client;
  }

  async runCycle(): ReturnType<SandboxProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    // Structural typing: the concrete Sandbox class is versioned with the
    // SDK; we only need the methods below.
    let sandbox: DaytonaSandboxShape | null = null;

    try {
      const daytona = this.getClient();

      timer.begin("create");
      sandbox = (await daytona.create()) as unknown as DaytonaSandboxShape;
      timer.end("create");

      const exec = "for i in 1 2 3 4 5 6 7 8 9 10; do echo ok$i; done";

      timer.begin("first_exec");
      await sandbox.process.executeCommand(`sh -c '${exec}'`);
      timer.end("first_exec");

      timer.begin("exec_overhead");
      await sandbox.process.executeCommand(`sh -c '${exec}'`);
      timer.end("exec_overhead");

      timer.begin("filesystem_write_1mb");
      const payload = Buffer.alloc(1024 * 1024, 0x78);
      await sandbox.fs.uploadFile(payload, "/tmp/bench-1mb.txt");
      timer.end("filesystem_write_1mb");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (sandbox && this.client) {
        timer.begin("teardown");
        try {
          await this.client.delete(sandbox as never);
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
    this.client = null;
  }
}
