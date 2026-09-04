/**
 * `syngraphe status`.
 *
 * A fast, offline, read-only summary of the repository context. It reuses the
 * same inspections and checks as `check`, so the two can never disagree.
 */

import { createCheckContext } from "../checks/context.ts";
import { runChecks } from "../checks/run.ts";
import type { CheckContext } from "../checks/types.ts";
import type { Output } from "../cli/output.ts";
import { EXIT_SUCCESS, type ExitCode } from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";
import { AGENTS_FILE } from "../templates/agents.ts";
import {
  ARCHITECTURE_PATH,
  CONTEXT_DIRECTORY,
  CONVENTIONS_PATH,
  CURRENT_STATE_PATH,
} from "../templates/context.ts";

const LABEL_WIDTH = 16;

export interface StatusOptions {
  repository: Repository;
  output: Output;
  now?: Date;
}

export async function runStatus(options: StatusOptions): Promise<ExitCode> {
  const context = await createCheckContext(options.repository, { now: options.now });
  const run = await runChecks(context);

  const lines: string[] = ["Syngraphe", ""];

  lines.push("Context");
  if (context.context.status === "absent") {
    lines.push(entry("status", "not initialized"));
  } else if (context.context.status === "unrelated") {
    lines.push(entry("status", `unrelated ${CONTEXT_DIRECTORY}/ directory`));
  } else {
    lines.push(entry("schema", schemaOf(context)));
    lines.push(entry("layout", context.context.manifest.layout ?? "unknown"));
  }
  lines.push("");

  lines.push("Knowledge");
  lines.push(entry("architecture", presence(context, ARCHITECTURE_PATH)));
  lines.push(entry("conventions", presence(context, CONVENTIONS_PATH)));
  lines.push(entry("current state", presence(context, CURRENT_STATE_PATH)));
  lines.push(entry("decisions", String(context.context.decisionCount)));
  lines.push(entry("history", String(context.context.historyCount)));
  lines.push("");

  lines.push("Agents");
  lines.push(entry(AGENTS_FILE, context.agentsBootstrap.status));
  for (const agent of context.agents) {
    const status =
      agent.state.status === "missing" && !agent.detection.present
        ? "not configured"
        : agent.state.status;
    lines.push(entry(agent.integration.displayName, status));
  }
  lines.push("");

  lines.push("Integrity");
  lines.push(`  ${run.errors} ${run.errors === 1 ? "error" : "errors"}`);
  lines.push(`  ${run.warnings} ${run.warnings === 1 ? "warning" : "warnings"}`);

  if (context.context.status === "absent") {
    lines.push("");
    lines.push("Run `syngraphe init` to create the repository context.");
  }

  options.output.write(lines.join("\n"));
  return EXIT_SUCCESS;
}

function schemaOf(context: CheckContext): string {
  const version = context.context.manifest.schemaVersion;
  return version === null ? "unknown" : `v${version}`;
}

function presence(context: CheckContext, path: string): string {
  return context.context.presentFiles.includes(path) ? "present" : "missing";
}

function entry(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`;
}
