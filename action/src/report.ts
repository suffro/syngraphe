import path from "node:path";
import { createCheckContext } from "../../src/checks/context.ts";
import { runChecks } from "../../src/checks/run.ts";
import type { Finding } from "../../src/checks/types.ts";
import { exitCodeFor } from "../../src/commands/check.ts";
import { SyngrapheError } from "../../src/core/errors.ts";
import {
  EXIT_INTEGRITY_FAILURE,
  EXIT_INTERNAL,
  EXIT_SUCCESS,
  EXIT_UNSUPPORTED_SCHEMA,
  EXIT_USAGE,
  type ExitCode,
} from "../../src/core/exit-codes.ts";
import { Repository, toPosix } from "../../src/core/repository.ts";
import { discoverScopes } from "../../src/core/scopes.ts";
import { type ContextStats, inspectStats } from "../../src/inspectors/stats.ts";
import type { ActionOptions } from "./options.ts";

export interface ScopeReport {
  scope: string;
  /** Prefix for annotations, relative to GITHUB_WORKSPACE. */
  workspacePath: string;
  check?: { ok: boolean; exitCode: ExitCode; findings: Finding[] };
  stats?: ContextStats;
  failures: { phase: "check" | "stats"; exitCode: ExitCode; message: string }[];
}

export interface ActionReport {
  version: 1;
  command: ActionOptions["command"];
  ok: boolean;
  exitCode: ExitCode;
  shouldFail: boolean;
  errors: number;
  warnings: number;
  failureCount: number;
  estimatedTokens: number;
  bytes: number;
  budgetExceeded: boolean;
  scopes: ScopeReport[];
}

/** Resolve checkout location independently from scope; never inspect a tree outside the workspace. */
export async function openCheckout(workspace: string, directory: string): Promise<Repository> {
  const base = Repository.atRoot(workspace);
  const selected = path.resolve(base.root, directory);
  const relative = path.relative(base.root, selected);
  if (path.isAbsolute(directory) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new SyngrapheError(
      "working-directory must be relative to and inside GITHUB_WORKSPACE.",
      EXIT_USAGE,
    );
  }
  await base.assertWritablePath(relative);
  if ((await base.kind(relative)) !== "directory") {
    throw new SyngrapheError(
      "working-directory must be an existing checkout directory.",
      EXIT_USAGE,
    );
  }
  const repository = await Repository.open(selected);
  // Git and workspace may use different aliases for the same directory (notably macOS /var).
  const realWorkspace = await base.realPath(".");
  if (realWorkspace === null)
    throw new SyngrapheError("GITHUB_WORKSPACE does not exist.", EXIT_USAGE);
  const rootRelative = path.relative(realWorkspace, repository.root);
  if (
    rootRelative === ".." ||
    rootRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rootRelative)
  ) {
    throw new SyngrapheError("The selected Git root is outside GITHUB_WORKSPACE.", EXIT_USAGE);
  }
  return repository;
}

/** Uses the same checks, exit policy and size inspector as the CLI. No shell or repository code. */
export async function collectReport(
  workspace: string,
  options: ActionOptions,
): Promise<ActionReport> {
  const root = await openCheckout(workspace, options.workingDirectory);
  const realWorkspace = await Repository.atRoot(workspace).realPath(".");
  if (realWorkspace === null)
    throw new SyngrapheError("GITHUB_WORKSPACE does not exist.", EXIT_USAGE);
  const repositories = options.all
    ? await discoverScopes(root)
    : [await root.inScope(options.scope ?? ".")];
  const report: ActionReport = {
    version: 1,
    command: options.command,
    ok: true,
    exitCode: EXIT_SUCCESS,
    shouldFail: false,
    errors: 0,
    warnings: 0,
    failureCount: 0,
    estimatedTokens: 0,
    bytes: 0,
    budgetExceeded: false,
    scopes: [],
  };
  let operationalFailure = false;
  const codes: ExitCode[] = [];
  const now = new Date();
  for (const repository of repositories) {
    const scope: ScopeReport = {
      scope: repository.scope,
      workspacePath: toPosix(path.relative(realWorkspace, repository.root)) || ".",
      failures: [],
    };
    for (const phase of ["check", "stats"] as const) {
      if (options.command !== "check-and-stats" && options.command !== phase) continue;
      try {
        if (phase === "check") {
          const run = await runChecks(await createCheckContext(repository, { now }));
          const exitCode = exitCodeFor(run, options.strict);
          scope.check = { ok: exitCode === EXIT_SUCCESS, exitCode, findings: run.findings };
          report.errors += run.errors;
          report.warnings += run.warnings;
          codes.push(exitCode);
        } else {
          scope.stats = await inspectStats(repository, options.budget);
          report.estimatedTokens += scope.stats.total.estimatedTokens;
          report.bytes += scope.stats.total.bytes;
          report.budgetExceeded ||= scope.stats.overBudget;
        }
      } catch (error) {
        const code = error instanceof SyngrapheError ? error.exitCode : EXIT_INTERNAL;
        scope.failures.push({
          phase,
          exitCode: code,
          message: error instanceof Error ? error.message : String(error),
        });
        report.failureCount++;
        codes.push(code);
        operationalFailure ||= code === EXIT_USAGE || code === EXIT_INTERNAL;
      }
    }
    report.scopes.push(scope);
  }
  const validationFailed = codes.some((code) => code !== EXIT_SUCCESS);
  if (options.failOnBudget && report.budgetExceeded) codes.push(EXIT_INTEGRITY_FAILURE);
  report.exitCode =
    ([EXIT_INTERNAL, EXIT_USAGE, EXIT_UNSUPPORTED_SCHEMA, EXIT_INTEGRITY_FAILURE] as const).find(
      (code) => codes.includes(code),
    ) ?? EXIT_SUCCESS;
  report.ok = report.exitCode === EXIT_SUCCESS;
  report.shouldFail =
    operationalFailure ||
    (options.failOnError && validationFailed) ||
    (options.failOnBudget && report.budgetExceeded);
  return report;
}

export interface ActionAnnotation {
  severity: "error" | "warning" | "notice";
  title: string;
  message: string;
  file?: string;
  line?: number;
}

export function annotationsFor(report: ActionReport): ActionAnnotation[] {
  const annotations: ActionAnnotation[] = [];
  for (const scope of report.scopes) {
    for (const finding of scope.check?.findings ?? []) {
      annotations.push({
        severity: finding.severity === "info" ? "notice" : finding.severity,
        title: finding.code,
        message: [finding.message, finding.details].filter(Boolean).join("\n"),
        file: finding.file ? path.posix.join(scope.workspacePath, finding.file) : undefined,
        line: finding.line,
      });
    }
    for (const failure of scope.failures)
      annotations.push({
        severity: "error",
        title: `Syngraphe ${failure.phase}`,
        message: `${scope.scope}: ${failure.message}`,
      });
    if (scope.stats?.overBudget)
      annotations.push({
        severity: "warning",
        title: "Syngraphe token budget",
        message: `${scope.scope}: ~${scope.stats.total.estimatedTokens} tokens exceed the budget of ${scope.stats.budget}.`,
      });
  }
  // Show integrity errors first when the log annotation budget is small.
  const priority = { error: 0, warning: 1, notice: 2 };
  return annotations.sort((a, b) => priority[a.severity] - priority[b.severity]);
}

function html(value: string): string {
  return value
    .slice(0, 1000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replace(/\r?\n/g, "<br>");
}

/** Bound summary size and escape repository-derived content; full detail stays in the JSON file. */
export function renderSummary(report: ActionReport): string {
  const lines = [
    "## Syngraphe",
    "",
    `**${report.ok ? "Passed" : "Issues found"}** — ${report.errors} errors, ${report.warnings} warnings, ${report.failureCount} execution failures.`,
    "",
    `Step policy: **${report.shouldFail ? "fail" : "pass"}**. Validation exit code: ${report.exitCode}.`,
    "",
    "| Scope | Check | Bytes | Estimated tokens | Budget |",
    "| --- | --- | ---: | ---: | --- |",
  ];
  for (const scope of report.scopes.slice(0, 100)) {
    lines.push(
      `| <code>${html(scope.scope)}</code> | ${scope.check ? (scope.check.ok ? "Passed" : "Issues") : "—"} | ${scope.stats?.total.bytes ?? "—"} | ${scope.stats?.total.estimatedTokens ?? "—"} | ${scope.stats ? (scope.stats.overBudget ? "Exceeded" : "Within") : "—"} |`,
    );
  }
  if (report.scopes.length > 100) lines.push("", "Additional scopes are in the JSON report.");
  const annotations = annotationsFor(report);
  if (annotations.length) {
    lines.push("", "### Findings", "");
    for (const finding of annotations.slice(0, 50))
      lines.push(`- <code>${html(finding.title)}</code>: ${html(finding.message)}`);
    if (annotations.length > 50) lines.push("", "Additional findings are in the JSON report.");
  }
  if (report.command !== "check")
    lines.push(
      "",
      `Total: ${report.bytes} bytes, ~${report.estimatedTokens} tokens. Tokens are estimated as ceil(UTF-8 bytes / 4) per Markdown file; budgets apply separately to each scope.`,
    );
  return `${lines.join("\n")}\n`;
}
