/**
 * Plan/apply core.
 *
 * Every command that modifies the repository builds a plan first, renders it,
 * and only then applies exactly that plan. Inspection and writing never happen
 * inside the same function, which is what makes `--dry-run` honest: it runs the
 * same planner and stops before `applyPlan`.
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

/**
 * Apply a plan.
 *
 * All preconditions are verified before the first write, so a plan built
 * against stale state fails without leaving the repository half modified.
 */
export async function applyPlan(repository: Repository, plan: Plan): Promise<void> {
  if (plan.conflicts.length > 0) {
    throw new SyngrapheError(
      "Refusing to apply a plan that reported conflicts.",
      EXIT_INTEGRITY_FAILURE,
    );
  }

  for (const operation of plan.operations) {
    if (operation.type === "create") {
      const kind = await repository.kind(operation.path);
      if (kind !== "missing") {
        throw new SyngrapheError(
          `Cannot create ${operation.path}: it already exists.`,
          EXIT_INTEGRITY_FAILURE,
          "The repository changed after the plan was built. Re-run the command.",
        );
      }
    } else {
      const current = await repository.read(operation.path);
      if (current !== operation.before) {
        throw new SyngrapheError(
          `Cannot patch ${operation.path}: the file changed since the plan was built.`,
          EXIT_INTEGRITY_FAILURE,
          "Re-run the command to build a fresh plan.",
        );
      }
    }
  }

  for (const operation of plan.operations) {
    const contents = operation.type === "create" ? operation.contents : operation.after;
    await repository.write(operation.path, contents);
  }
}
