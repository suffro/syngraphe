import path from "node:path";
import * as core from "@actions/core";
import { SyngrapheError } from "../../src/core/errors.ts";
import { EXIT_INTERNAL, EXIT_USAGE } from "../../src/core/exit-codes.ts";
import { createTemporaryDirectory } from "../../src/core/fs.ts";
import { Repository } from "../../src/core/repository.ts";
import { readOptions } from "./options.ts";
import { annotationsFor, collectReport, renderSummary } from "./report.ts";

async function execute(): Promise<void> {
  try {
    const options = readOptions(core.getInput);
    const workspace = process.env.GITHUB_WORKSPACE;
    const temporaryRoot = process.env.RUNNER_TEMP;
    if (!workspace || !temporaryRoot)
      throw new SyngrapheError(
        "GITHUB_WORKSPACE and RUNNER_TEMP must be set by the runner.",
        EXIT_USAGE,
      );
    const report = await collectReport(workspace, options);
    const directory = await createTemporaryDirectory(temporaryRoot, "syngraphe-action-");
    await Repository.atRoot(directory).write("report.json", `${JSON.stringify(report, null, 2)}\n`);

    // Keep the potentially large report out of GitHub's size-limited step outputs.
    for (const [name, value] of Object.entries({
      "report-path": path.join(directory, "report.json"),
      "exit-code": report.exitCode,
      ok: report.ok,
      errors: report.errors,
      warnings: report.warnings,
      "failure-count": report.failureCount,
      "scope-count": report.scopes.length,
      "estimated-tokens": report.estimatedTokens,
      bytes: report.bytes,
      "budget-exceeded": report.budgetExceeded,
    }))
      core.setOutput(name, value);

    if (options.annotations) {
      const annotations = annotationsFor(report);
      for (const finding of annotations.slice(0, options.maxAnnotations)) {
        const annotate = { error: core.error, warning: core.warning, notice: core.notice }[
          finding.severity
        ];
        annotate(finding.message, {
          title: finding.title,
          file: finding.file,
          startLine: finding.line,
        });
      }
      if (annotations.length > options.maxAnnotations)
        core.info(
          `Additional annotations omitted: ${annotations.length - options.maxAnnotations}. See the JSON report.`,
        );
    }
    if (options.summary) await core.summary.addRaw(renderSummary(report)).write();
    core.info(
      `Syngraphe: ${report.scopes.length} scope(s), ${report.errors} errors, ${report.warnings} warnings, ${report.failureCount} execution failures.`,
    );
    if (report.shouldFail)
      core.setFailed(
        `Syngraphe failed (validation exit code ${report.exitCode}). See the report for details.`,
      );
  } catch (error) {
    const code = error instanceof SyngrapheError ? error.exitCode : EXIT_INTERNAL;
    core.setOutput("exit-code", code);
    core.setOutput("ok", false);
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void execute();
