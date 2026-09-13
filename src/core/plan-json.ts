/** Stable, content-free JSON projection of an internal mutation plan. */

import type { Plan } from "./plan.ts";

/** Version of the public plan JSON shape; independent from every other report version. */
export const PLAN_JSON_VERSION = 1;

export type PlanJsonOperation =
  | {
      type: "create";
      path: string;
      summary?: string;
    }
  | {
      type: "patch";
      path: string;
      summary: string;
    };

export interface PlanJsonUnchangedEntry {
  path: string;
  reason: string;
}

export interface PlanJsonConflict {
  path?: string;
  message: string;
  details?: string;
}

export interface PlanJsonReport {
  version: typeof PLAN_JSON_VERSION;
  ok: boolean;
  scope: string;
  operations: PlanJsonOperation[];
  unchanged: PlanJsonUnchangedEntry[];
  conflicts: PlanJsonConflict[];
}

/**
 * Project an internal plan into the public JSON contract.
 *
 * File contents and patch before/after states are deliberately excluded. The
 * operation, unchanged and conflict arrays retain the plan's own ordering.
 */
export function planToJson(plan: Plan, scope: string): PlanJsonReport {
  return {
    version: PLAN_JSON_VERSION,
    ok: plan.conflicts.length === 0,
    scope,
    operations: plan.operations.map((operation) => {
      if (operation.type === "patch") {
        return {
          type: operation.type,
          path: operation.path,
          summary: operation.summary,
        };
      }
      return {
        type: operation.type,
        path: operation.path,
        ...(operation.summary === undefined ? {} : { summary: operation.summary }),
      };
    }),
    unchanged: plan.unchanged.map((entry) => ({ path: entry.path, reason: entry.reason })),
    conflicts: plan.conflicts.map((conflict) => ({
      ...(conflict.path === null ? {} : { path: conflict.path }),
      message: conflict.message,
      ...(conflict.details === null ? {} : { details: conflict.details }),
    })),
  };
}
