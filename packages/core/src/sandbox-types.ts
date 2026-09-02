export const SANDBOX_PHASES = [
  "create",
  "first_exec",
  "exec_overhead",
  "filesystem_write_1mb",
  "teardown",
] as const;

export type SandboxPhase = (typeof SANDBOX_PHASES)[number];

/**
 * One sandbox lifecycle. `exec_overhead` measures the MARGINAL cost of a
 * second command in the same sandbox — the number that dominates agent
 * loops, since agents exec hundreds of times per sandbox.
 */
export interface SandboxProviderAdapter {
  name: string;
  primitive: "sandbox";
  availability(): { available: boolean; missing: string[] };
  meta(): { [key: string]: unknown };
  runCycle(): Promise<{
    phases: { [phase: string]: { t0: number; t1: number } };
    providerMeta: { [key: string]: unknown };
    error?: string;
  }>;
  dispose(): Promise<void>;
}
