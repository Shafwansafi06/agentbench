#!/usr/bin/env node
import { resolveProviders } from "@agentbench/browser-adapters";
import { runBenchmark, type CycleRecord } from "@agentbench/core";
import {
  resolveSandboxProviders,
  runSandboxBenchmark,
} from "@agentbench/sandbox-adapters";
import { loadDotEnv } from "./env.js";
import { compositeTable, failedCycles, phaseTable } from "./table.js";

/**
 * TODO(day 3, MUST land before first published run): self-hosted control
 * page with a known payload, DNS/TLS/TTFB measured separately. example.com
 * measures THEIR CDN, not the provider, and must never appear in published
 * data. Fine for development runs only.
 */
const DEV_CONTROL_PAGE = "https://example.com";

interface Flags {
  primitive: "browser" | "sandbox";
  providers: string[];
  n: number;
  warmup: number;
  url: string;
  region: string;
  out: string;
  listProviders: boolean;
}

function usage(): never {
  console.log(`agentbench — independent benchmark for AI agent infrastructure

Usage:
  agentbench run [--primitive browser|sandbox] [--providers a,b] [--n 50]
                 [--warmup 3] [--url URL] [--region NAME] [--out DIR]
  agentbench providers

Options:
  --primitive   browser (default) or sandbox
  --providers   comma-separated provider names (default: solari,browserbase)
  --n           measured cycles per provider (default 50)
  --warmup      discarded warmup cycles per provider (default 3)
  --url         navigation target (default: dev placeholder, see METHODOLOGY)
  --region      runner region label (default "local"; CI sets us-east etc.)
  --out         output directory for JSONL (default data/runs)`);
  process.exit(0);
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    primitive: "browser",
    providers: ["solari", "browserbase"],
    n: 50,
    warmup: 3,
    url: DEV_CONTROL_PAGE,
    region: "local",
    out: "data/runs",
    listProviders: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const value = (): string => {
      if (i + 1 >= argv.length) {
        console.error(`missing value for ${arg}`);
        process.exit(1);
      }
      return argv[++i] as string;
    };
    switch (arg) {
      case "run":
        break;
      case "--primitive":
        flags.primitive = value() as Flags["primitive"];
        break;
      case "--providers":
        flags.providers = value().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--n":
        flags.n = Math.max(1, parseInt(value(), 10));
        break;
      case "--warmup":
        flags.warmup = Math.max(0, parseInt(value(), 10));
        break;
      case "--url":
        flags.url = value();
        break;
      case "--region":
        flags.region = value();
        break;
      case "--out":
        flags.out = value();
        break;
      case "providers":
      case "--list-providers":
        flags.listProviders = true;
        break;
      case "--help":
      case "-h":
        usage();
        break;
      default:
        console.error(`unknown flag: ${arg}`);
        usage();
    }
  }
  return flags;
}

function main(): Promise<void> {
  return run();
}

async function run(): Promise<void> {
  loadDotEnv();
  const flags = parseFlags(process.argv.slice(2));

  if (flags.listProviders) {
    const { BROWSER_PROVIDERS } = await import("@agentbench/browser-adapters");
    const { SANDBOX_PROVIDERS } = await import("@agentbench/sandbox-adapters");
    for (const p of [...BROWSER_PROVIDERS, ...SANDBOX_PROVIDERS]) {
      const status = p.availability();
      console.log(
        `${p.primitive.padEnd(8)} ${p.name.padEnd(12)} ${status.available ? "ready" : `NOT configured — missing: ${status.missing.join(", ")}`}`
      );
    }
    return;
  }

  if (flags.primitive === "sandbox") {
    const { providers, unknown, unavailable } = resolveSandboxProviders(
      flags.providers
    );
    if (unknown.length > 0) {
      console.error(
        `unknown sandbox providers: ${unknown.join(", ")} (known: solari, e2b, daytona)`
      );
      process.exit(1);
    }
    for (const u of unavailable) {
      console.warn(
        `⚠ ${u.name}: not measured — no access (missing ${u.missing.join(", ")}).`
      );
    }
    if (providers.length === 0) {
      console.error("no sandbox providers configured — see .env.example");
      process.exit(1);
    }
    const { makeRunId } = await import("@agentbench/core");
    const runId = makeRunId();
    console.log(
      `run ${runId} | primitive: sandbox | providers: ${providers.map((p) => p.name).join(", ")} | n=${flags.n} warmup=${flags.warmup} | region=${flags.region}`
    );
    let done = 0;
    const total = (flags.warmup + flags.n) * providers.length;
    const summary = await runSandboxBenchmark({
      providers,
      n: flags.n,
      warmup: flags.warmup,
      region: flags.region,
      outDir: flags.out,
      runId,
      onCycle: (r) => {
        done++;
        const label = r.warmup ? "warmup" : r.success ? "ok" : "FAIL";
        const trip =
          r.full_round_trip_ns !== undefined
            ? ` ${(r.full_round_trip_ns / 1e6).toFixed(0)}ms`
            : "";
        console.log(`  [${done}/${total}] ${r.provider} ${label}${trip}`);
      },
    });
    console.log(`\nraw data: ${summary.outPath}\n`);
    console.log(compositeTable(summary.records));
    console.log("\nphases, p50 ms:\n");
    console.log(phaseTable(summary.records));
    const failures = failedCycles(summary.records);
    if (failures.length > 0) {
      console.log(`\nfailed cycles (${failures.length}):`);
      for (const line of failures.slice(0, 10)) console.log(`  ${line}`);
    }
    await Promise.all(providers.map((p) => p.dispose()));
    return;
  }

  const { providers, unknown, unavailable } = resolveProviders(flags.providers);
  if (unknown.length > 0) {
    console.error(`unknown providers: ${unknown.join(", ")}`);
    console.error(`known: solari, browserbase, steel, kernel, hyperbrowser, anchor`);
    process.exit(1);
  }
  for (const u of unavailable) {
    console.warn(
      `⚠ ${u.name}: not measured — no access (missing ${u.missing.join(", ")}). Listed in results as skipped.`
    );
  }
  if (providers.length === 0) {
    console.error("no providers configured — set API keys in .env (see .env.example)");
    process.exit(1);
  }

  const { runBenchmark, makeRunId } = await import("@agentbench/core");
  const runId = makeRunId();
  console.log(
    `run ${runId} | providers: ${providers.map((p) => p.name).join(", ")} | n=${flags.n} warmup=${flags.warmup} | region=${flags.region}`
  );

  let done = 0;
  const total = (flags.warmup + flags.n) * providers.length;
  const onCycle = (r: CycleRecord) => {
    done++;
    const label = r.warmup ? "warmup" : r.success ? "ok" : "FAIL";
    const trip = r.full_round_trip_ns !== undefined ? ` ${(r.full_round_trip_ns / 1e6).toFixed(0)}ms` : "";
    const err = r.error ? ` ${r.error}` : "";
    console.log(`  [${done}/${total}] ${r.provider} ${label}${trip}${err}`);
  };

  const summary = await runBenchmark({
    providers,
    n: flags.n,
    warmup: flags.warmup,
    url: flags.url,
    region: flags.region,
    outDir: flags.out,
    runId,
    onCycle,
  });

  console.log(`\nraw data: ${summary.outPath}\n`);
  console.log("full round trip (create → connect → navigate → teardown):\n");
  console.log(compositeTable(summary.records));
  console.log("\nphases, p50 ms:\n");
  console.log(phaseTable(summary.records));

  const failures = failedCycles(summary.records);
  if (failures.length > 0) {
    console.log(`\nfailed cycles (${failures.length}):`);
    for (const line of failures.slice(0, 10)) console.log(`  ${line}`);
    if (failures.length > 10) console.log(`  … ${failures.length - 10} more`);
  }

  await Promise.all(providers.map((p) => p.dispose()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
