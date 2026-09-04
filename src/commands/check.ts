/**
 * `syngraphe check`.
 *
 * Runs the deterministic check registry and reports findings, either for
 * humans or as stable JSON. It is read-only: nothing here writes, and nothing
 * here reaches the network.
 */

import { createCheckContext } from "../checks/context.ts";
import { type CheckRun, runChecks } from "../checks/run.ts";
import type { Finding } from "../checks/types.ts";
import type { Output } from "../cli/output.ts";
import {
  EXIT_INTEGRITY_FAILURE,
  EXIT_SUCCESS,
  EXIT_UNSUPPORTED_SCHEMA,
  type ExitCode,
} from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";

/** Version of the `--json` payload shape. */
export const CHECK_JSON_VERSION = 1;

export interface CheckOptions {
  repository: Repository;
  output: Output;
  json: boolean;
  strict: boolean;
  /** Reference instant for age-based checks; tests pass a fixed value. */
  now?: Date;
}

export async function runCheck(options: CheckOptions): Promise<ExitCode> {
  const context = await createCheckContext(options.repository, { now: options.now });
  const run = await runChecks(context);
  const exitCode = exitCodeFor(run, options.strict);

  if (options.json) {
    options.output.write(renderJson(run, exitCode));
  } else {
    options.output.write(renderHuman(run));
  }

  return exitCode;
}

function exitCodeFor(run: CheckRun, strict: boolean): ExitCode {
  if (run.findings.some((finding) => finding.code === "MANIFEST003")) {
    return EXIT_UNSUPPORTED_SCHEMA;
  }
  if (run.errors > 0) return EXIT_INTEGRITY_FAILURE;
  if (strict && run.warnings > 0) return EXIT_INTEGRITY_FAILURE;
  return EXIT_SUCCESS;
}

function renderJson(run: CheckRun, exitCode: ExitCode): string {
  const payload = {
    version: CHECK_JSON_VERSION,
    ok: exitCode === EXIT_SUCCESS,
    findings: run.findings.map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      category: finding.category,
      ...(finding.file === undefined ? {} : { file: finding.file }),
      ...(finding.line === undefined ? {} : { line: finding.line }),
      message: finding.message,
      ...(finding.details === undefined ? {} : { details: finding.details }),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function renderHuman(run: CheckRun): string {
  const lines: string[] = ["Syngraphe context integrity", ""];

  for (const result of run.results) {
    lines.push(`${symbolFor(result.findings)} ${result.check.label}`);
  }

  for (const finding of run.findings) {
    lines.push("");
    lines.push(`${labelFor(finding)} ${finding.code}${locationFor(finding)}`);
    lines.push(finding.message);
    if (finding.details) lines.push(finding.details);
  }

  lines.push("");
  lines.push(summaryFor(run));
  return lines.join("\n");
}

function symbolFor(findings: Finding[]): string {
  if (findings.some((finding) => finding.severity === "error")) return "✗";
  if (findings.some((finding) => finding.severity === "warning")) return "!";
  return "✓";
}

function labelFor(finding: Finding): string {
  switch (finding.severity) {
    case "error":
      return "ERROR";
    case "warning":
      return "WARN";
    case "info":
      return "INFO";
  }
}

function locationFor(finding: Finding): string {
  if (!finding.file) return "";
  return finding.line === undefined ? `  ${finding.file}` : `  ${finding.file}:${finding.line}`;
}

function summaryFor(run: CheckRun): string {
  if (run.errors === 0 && run.warnings === 0) return "No problems found.";
  const parts: string[] = [];
  if (run.errors > 0) parts.push(`${run.errors} error${run.errors === 1 ? "" : "s"}`);
  if (run.warnings > 0) parts.push(`${run.warnings} warning${run.warnings === 1 ? "" : "s"}`);
  return parts.join(", ");
}
