/**
 * `syngraphe init`.
 *
 * The command is the composition root: it asks the inspectors what exists,
 * asks the agent registry what each integration would do, merges everything
 * into one plan, renders it, and only then applies it. `--dry-run` stops right
 * before the apply step and shares the identical plan.
 */

import { inspectAgentsBootstrap, planAgentsBootstrap } from "../agents/agents-md.ts";
import { agentIntegrations } from "../agents/registry.ts";
import type { Output } from "../cli/output.ts";
import { SyngrapheError } from "../core/errors.ts";
import {
  EXIT_INTEGRITY_FAILURE,
  EXIT_SUCCESS,
  EXIT_UNSUPPORTED_SCHEMA,
  type ExitCode,
} from "../core/exit-codes.ts";
import { applyPlan, emptyPlan, type Plan } from "../core/plan.ts";
import { renderPlan } from "../core/render-plan.ts";
import type { Repository } from "../core/repository.ts";
import { inspectContext } from "../inspectors/context.ts";
import {
  CONTEXT_DIRECTORY,
  CONTEXT_SCHEMA_VERSION,
  CONTEXT_TEMPLATES,
  MANIFEST_PATH,
} from "../templates/context.ts";

export interface InitOptions {
  repository: Repository;
  output: Output;
  dryRun: boolean;
}

/**
 * Build the initialization plan.
 *
 * Throws when the repository is in a state Syngraphe must not act on at all;
 * conditions that only block part of the work are reported as plan conflicts.
 */
export async function planInitialization(repository: Repository): Promise<Plan> {
  const plan = emptyPlan();
  const context = await inspectContext(repository);

  switch (context.status) {
    case "unrelated":
      throw new SyngrapheError(
        `${CONTEXT_DIRECTORY}/ already exists and is not a Syngraphe repository context.`,
        EXIT_INTEGRITY_FAILURE,
        `${context.conflictReason ?? ""} Syngraphe will not modify it. Move or rename it, then re-run.`.trim(),
      );

    case "unsupported-schema":
      throw new SyngrapheError(
        `${MANIFEST_PATH} declares schema version ${context.manifest.schemaVersion}.`,
        EXIT_UNSUPPORTED_SCHEMA,
        `This Syngraphe build supports schema version ${CONTEXT_SCHEMA_VERSION}. Upgrade Syngraphe instead of changing the manifest.`,
      );

    case "invalid-manifest":
      throw new SyngrapheError(
        `${MANIFEST_PATH} is not a valid Syngraphe manifest.`,
        EXIT_INTEGRITY_FAILURE,
        context.manifest.parseError ??
          "Repair the manifest manually; Syngraphe will not overwrite it.",
      );

    default:
      break;
  }

  for (const template of CONTEXT_TEMPLATES) {
    if (context.presentFiles.includes(template.path)) continue;
    plan.operations.push({ type: "create", path: template.path, contents: template.contents });
  }
  if (plan.operations.length === 0) {
    plan.unchanged.push({ path: `${CONTEXT_DIRECTORY}/`, reason: "already initialized" });
  }

  merge(plan, planAgentsBootstrap(await inspectAgentsBootstrap(repository)));

  for (const integration of agentIntegrations) {
    merge(plan, await integration.planIntegration(repository));
  }

  return plan;
}

export async function runInit(options: InitOptions): Promise<ExitCode> {
  const { repository, output, dryRun } = options;
  const plan = await planInitialization(repository);

  const title = dryRun ? "Syngraphe initialization plan" : "Syngraphe initialization";
  output.write(renderPlan(plan, title));

  if (plan.conflicts.length > 0) {
    output.writeError("Initialization stopped: resolve the conflicts above and re-run.");
    return EXIT_INTEGRITY_FAILURE;
  }

  if (dryRun) {
    output.write("\nNo files were modified.");
    return EXIT_SUCCESS;
  }

  if (plan.operations.length === 0) return EXIT_SUCCESS;

  await applyPlan(repository, plan);
  const count = plan.operations.length;
  output.write(`\n${count} file${count === 1 ? "" : "s"} written.`);
  return EXIT_SUCCESS;
}

function merge(target: Plan, source: Plan): void {
  target.operations.push(...source.operations);
  target.unchanged.push(...source.unchanged);
  target.conflicts.push(...source.conflicts);
}
