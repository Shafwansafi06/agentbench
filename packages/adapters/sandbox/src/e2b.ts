import { Sandbox } from "e2b";
import { PhaseTimer } from "@agentbench/core";
import type { SandboxProviderAdapter } from "@agentbench/core";
import { sdkVersion } from "./solari.js";

/**
 * E2B adapter.
 *
 * API from e2b dist typings v2.46: Sandbox.create(opts) → commands.run /
 * files.write / kill. E2B's own docs pitch ~sub-second create from
 * snapshot; this adapter measures that claim the same way it measures
 * everyone else.
 */
export class E2BSandboxProvider implements SandboxProviderAdapter {
  readonly name = "e2b";
  readonly primitive = "sandbox" as const;

  availability() {
    const missing = process.env.E2B_API_KEY ? [] : ["E2B_API_KEY"];
    return { available: missing.length === 0, missing };
  }

  meta() {
    return {
      sdk: "e2b",
      sdk_version: sdkVersion("e2b"),
      plan_tier: process.env.E2B_PLAN_TIER ?? "undisclosed",
    };
  }

  async runCycle(): ReturnType<SandboxProviderAdapter["runCycle"]> {
    const timer = new PhaseTimer();
    let error: string | undefined;
    let sandbox: Sandbox | null = null;

    try {
      timer.begin("create");
      sandbox = await Sandbox.create({ timeoutMs: 2 * 60_000 });
      timer.end("create");

      const exec = "for i in 1 2 3 4 5 6 7 8 9 10; do echo ok$i; done";

      timer.begin("first_exec");
      // E2B v2: run() takes the full command string; no separate argv field.
      await sandbox.commands.run(`sh -c '${exec}'`);
      timer.end("first_exec");

      timer.begin("exec_overhead");
      await sandbox.commands.run(`sh -c '${exec}'`);
      timer.end("exec_overhead");

      timer.begin("filesystem_write_1mb");
      const payload = "x".repeat(1024 * 1024);
      await sandbox.files.write("/tmp/bench-1mb.txt", payload);
      timer.end("filesystem_write_1mb");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (sandbox) {
        timer.begin("teardown");
        try {
          await sandbox.kill();
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

  async dispose(): Promise<void> {}
}
