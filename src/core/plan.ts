/**
 * Plan/apply core.
 *
 * Every command that modifies the repository builds a plan first, renders it,
 * and only then applies exactly that plan. Inspection and writing never happen
 * inside the same function, which is what makes `--dry-run` honest: it runs the
 * same planner and stops before `applyPlan`. Planners receive a
 * `ReadOnlyRepository`, so the compiler, not convention, keeps them from writing.
 */

import { SyngrapheError } from "./errors.ts";
import { EXIT_INTEGRITY_FAILURE } from "./exit-codes.ts";
import type { Repository } from "./repository.ts";

export type FileOperation =
  | {
      type: "create";
      path: string;
      contents: string;
      /** Short description of what the created file is for. */
      summary?: string;
    }
  | {
      type: "patch";
      path: string;
      /** Exact expected current content; a mismatch aborts the apply. */
      before: string;
      after: string;
      summary: string;
    };

export interface UnchangedEntry {
  path: string;
  reason: string;
}

export interface PlanConflict {
  path: string | null;
  message: string;
  details: string | null;
}

export interface Plan {
  operations: FileOperation[];
  unchanged: UnchangedEntry[];
  conflicts: PlanConflict[];
}

export function emptyPlan(): Plan {
  return { operations: [], unchanged: [], conflicts: [] };
}

function destinationTaken(path: string): SyngrapheError {
  return new SyngrapheError(
    `Cannot create ${path}: it already exists.`,
    EXIT_INTEGRITY_FAILURE,
    "The repository changed after the plan was built. Re-run the command.",
  );
}

function fileChanged(path: string): SyngrapheError {
  return new SyngrapheError(
    `Cannot patch ${path}: the file changed since the plan was built.`,
    EXIT_INTEGRITY_FAILURE,
    "Re-run the command to build a fresh plan.",
  );
}

/**
 * Apply a plan.
 *
 * All preconditions are verified before the first write, so a plan built
 * against stale state fails without leaving the repository half modified.
 *
 * The preflight is not what makes publication safe: between the check and the
 * write, another process can take a destination or edit a file. Each operation
 * is therefore verified again by the step that publishes it. `create` claims
 * its path with an operation that fails when the path is taken; `patch` moves
 * the file aside before comparing it, so the bytes it compares are the bytes it
 * replaces. The preflight stays because it turns the ordinary stale-plan case
 * into a failure before anything is written at all.
 */
export async function applyPlan(repository: Repository, plan: Plan): Promise<void> {
  if (plan.conflicts.length > 0) {
    throw new SyngrapheError(
      "Refusing to apply a plan that reported conflicts.",
      EXIT_INTEGRITY_FAILURE,
    );
  }

  for (const operation of plan.operations) {
    await repository.assertWritablePath(operation.path);
    if (operation.type === "create") {
      const kind = await repository.kind(operation.path);
      if (kind !== "missing") throw destinationTaken(operation.path);
    } else {
      // Bytes, not decoded text: a lossy decode can make two different files equal.
      const current = await repository.readBytes(operation.path);
      if (current === null || !current.equals(Buffer.from(operation.before, "utf8"))) {
        throw fileChanged(operation.path);
      }
    }
  }

  for (const operation of plan.operations) {
    if (operation.type === "patch") {
      if (!(await repository.replace(operation.path, operation.before, operation.after))) {
        throw fileChanged(operation.path);
      }
      continue;
    }
    if (!(await repository.create(operation.path, operation.contents))) {
      throw destinationTaken(operation.path);
    }
  }
}
