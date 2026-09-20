/**
 * `syngraphe policy add`, and the `--policy` flag of `syngraphe init`.
 *
 * `AGENT-POLICY.md` is a seed, not a managed file: Syngraphe writes it once and
 * never owns its contents afterwards. That is why nothing here compares it
 * against a template, and why replacing an edited one needs `--force` spelled
 * out on the command line rather than a prompt — the CLI has no interactive
 * mode, and a plan that depends on a terminal could not be dry-run, scripted or
 * run in CI.
 */

import type { Output } from "../cli/output.ts";
import { SyngrapheError } from "../core/errors.ts";
import {
  EXIT_INTEGRITY_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  type ExitCode,
} from "../core/exit-codes.ts";
import { decodeUtf8Exact } from "../core/fs.ts";
import { applyPlan, emptyPlan, type Plan } from "../core/plan.ts";
import type { ReadOnlyRepository, Repository } from "../core/repository.ts";
import { POLICY_CONTENTS, POLICY_FILE } from "../templates/policy.ts";
import { validatePlanOutputOptions, writePlanOutput } from "./plan-output.ts";

export const POLICY_CREATE_SUMMARY = "Agent operating policy";
export const POLICY_REPLACE_SUMMARY = "Replace the agent operating policy with the template";

export interface PolicyPlanOptions {
  /** Replace an existing policy file with the current template. */
  force?: boolean;
  /**
   * Leave an existing policy file alone instead of reporting a conflict.
   * `init --policy` sets it: initialization has to stay idempotent, and the
   * file belongs to the repository once it exists.
   */
  keepExisting?: boolean;
}

/**
 * Plan the policy file.
 *
 * One policy governs the whole repository, so it is a Git-root concept: a
 * scoped run is a usage error rather than a second policy in a subdirectory.
 */
export async function planPolicy(
  repository: ReadOnlyRepository,
  options: PolicyPlanOptions = {},
): Promise<Plan> {
  if (repository.scope !== ".") {
    throw new SyngrapheError(
      `${POLICY_FILE} belongs to the repository root.`,
      EXIT_USAGE,
      "Run the command without --scope; one policy governs every scope in the Git repository.",
    );
  }

  const plan = emptyPlan();
  await repository.assertWritablePath(POLICY_FILE);

  // Case-only collisions are decided from directory entries, not from a stat:
  // on a case-insensitive filesystem `agent-policy.md` is the same path, and on
  // a case-sensitive one creating a second spelling breaks the repository for
  // everybody else.
  const entries = await repository.list(".");
  const collision = entries?.find(
    (entry) => entry !== POLICY_FILE && entry.toLowerCase() === POLICY_FILE.toLowerCase(),
  );
  const kind = await repository.kind(POLICY_FILE);

  // Whatever is already there, `init --policy` leaves it and says so. The
  // policy is an optional extra, so nothing about it may stop initialization.
  if (options.keepExisting && (collision !== undefined || kind !== "missing")) {
    plan.unchanged.push({ path: collision ?? POLICY_FILE, reason: "already present" });
    return plan;
  }

  if (collision !== undefined) {
    plan.conflicts.push({
      path: collision,
      message: `${collision} already exists and differs from ${POLICY_FILE} only by case.`,
      details: `Rename it to ${POLICY_FILE} and re-run; on case-insensitive filesystems the two are one file.`,
    });
    return plan;
  }

  if (kind === "missing") {
    plan.operations.push({
      type: "create",
      path: POLICY_FILE,
      contents: POLICY_CONTENTS,
      summary: POLICY_CREATE_SUMMARY,
    });
    return plan;
  }

  if (kind !== "file") {
    plan.conflicts.push({
      path: POLICY_FILE,
      message: `${POLICY_FILE} exists but is not a regular file (${kind}).`,
      details: "Syngraphe does not write through links or over directories.",
    });
    return plan;
  }

  if (!options.force) {
    plan.conflicts.push({
      path: POLICY_FILE,
      message: `${POLICY_FILE} already exists.`,
      details:
        "Syngraphe does not own its contents. Re-run with --force to replace it with the current template.",
    });
    return plan;
  }

  const bytes = await repository.readBytes(POLICY_FILE);
  const current = bytes === null ? null : decodeUtf8Exact(bytes);
  if (current === null) {
    plan.conflicts.push({
      path: POLICY_FILE,
      message: `${POLICY_FILE} must be valid UTF-8 to be replaced safely.`,
      details: "Syngraphe compares the exact bytes it replaces, so it will not overwrite blindly.",
    });
    return plan;
  }

  if (current === POLICY_CONTENTS) {
    plan.unchanged.push({ path: POLICY_FILE, reason: "already matches the template" });
    return plan;
  }

  plan.operations.push({
    type: "patch",
    path: POLICY_FILE,
    before: current,
    after: POLICY_CONTENTS,
    summary: POLICY_REPLACE_SUMMARY,
  });
  return plan;
}

export async function runPolicy(options: {
  repository: Repository;
  output: Output;
  force?: boolean;
  dryRun: boolean;
  json?: boolean;
}): Promise<ExitCode> {
  const json = options.json ?? false;
  validatePlanOutputOptions({ dryRun: options.dryRun, json });
  const plan = await planPolicy(options.repository, { force: options.force });

  writePlanOutput({
    output: options.output,
    plan,
    scope: options.repository.scope,
    title: "Syngraphe agent policy",
    json,
  });

  if (plan.conflicts.length > 0) {
    options.output.writeError("No policy was written: resolve the conflict above and re-run.");
    return EXIT_INTEGRITY_FAILURE;
  }

  if (options.dryRun) {
    if (!json) options.output.write("\nNo files were modified.");
    return EXIT_SUCCESS;
  }

  if (plan.operations.length === 0) return EXIT_SUCCESS;

  await applyPlan(options.repository, plan);
  options.output.write(`\n${plan.operations.length} file written.`);
  return EXIT_SUCCESS;
}
