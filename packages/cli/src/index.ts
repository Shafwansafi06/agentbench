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
 * Fixed navigation target. Deployed control page (see control-page/README)
 * isolates provider overhead from third-party CDN noise — never point
 * published numbers at example.com.
 */
const CONTROL_PAGE_URL = "https://control-page-dzsxszhwb-on-chaineds-projects.vercel.app";

interface Flags {
  primitive: "browser" | "sandbox";
  providers: string[];
  n: number;
  warmup: number;
  url: string;
  region: string;
  out: string;
  listProviders: boolean;
  sustained: number | null;
}

function usage(): never {
  console.log(`agentbench — independent benchmark for AI agent infrastructure

Usage:
  agentbench run [--primitive browser|sandbox] [--providers a,b] [--n 50]
                 [--warmup 3] [--url URL] [--region NAME] [--out DIR]
                 [--sustained 100]
  agentbench providers

Options:
  --primitive   browser (default) or sandbox
  --providers   comma-separated provider names (default: solari,browserbase)
  --n           measured cycles per provider (default 50)
  --warmup      discarded warmup cycles per provider (default 3)
  --sustained   sustained agent-loop mode: N sequential cycles per provider,
                reports p95 degradation first-third vs last-third
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
    url: process.env.CONTROL_PAGE_URL ?? CONTROL_PAGE_URL,
    region: "local",
    out: "data/runs",
    listProviders: false,
    sustained: null,
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
      case "--sustained":
        flags.sustained = Math.max(3, parseInt(value(), 10));
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

function fmtNs(ns: number): string {
  return Number.isNaN(ns) ? "—" : `${(ns / 1e6).toFixed(0)}ms`;
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

  if (flags.sustained !== null) {
    const { runSustainedLoop } = await import("@agentbench/core");
    const total = flags.sustained * providers.length;
    let done = 0;
    const results: { report: Awaited<ReturnType<typeof runSustainedLoop>>["report"]; outPath: string }[] = [];

    for (const provider of providers) {
      const { records, report } = await runSustainedLoop({
        provider,
        n: flags.sustained,
        url: flags.url,
        region: flags.region,
        outDir: flags.out,
        onCycle: (r) => {
          const label = r.warmup ? "warmup" : r.success ? "ok" : "FAIL";
          console.log(
            `  [${++done}/${total}] ${r.provider} ${label}${r.full_round_trip_ns !== undefined ? ` ${(r.full_round_trip_ns / 1e6).toFixed(0)}ms` : ""}`
          );
        },
      });
      results.push({ report, outPath: "" } as never);
      void records;
    }

    console.log("\n== sustained agent loop (first-third vs last-third) ==\n");
    for (const { report } of results) {
      const fms = report.firstThird;
      const lms = report.lastThird;
      const deg =
        Number.isNaN(report.degradationP95Ns)
          ? "—"
          : `${(report.degradationP95Ns / 1e6 >= 0 ? "+" : "")}${(report.degradationP95Ns / 1e6).toFixed(0)}ms`;
      console.log(
        `${report.provider}: ${report.ok}/${report.cycles} ok | ` +
          `p50 ${fmtNs(fms.p50)}→${fmtNs(lms.p50)} | ` +
          `p95 ${fmtNs(fms.p95)}→${fmtNs(lms.p95)} | ` +
          `errors ${fms.errors}→${lms.errors} | degradation(p95) ${deg}`
      );
    }
    await Promise.all(providers.map((p) => p.dispose()));
    return;
  }

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
