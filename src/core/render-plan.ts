/**
 * Plain-text rendering of a plan. Deliberately simple: no colours, no width
 * detection, no spinners — output that is readable in a terminal and in a CI
 * log, and stable enough to assert on in tests.
 */

import type { Plan } from "./plan.ts";

export function renderPlan(plan: Plan, title: string): string {
  const lines: string[] = [title, ""];

  const creates = plan.operations.filter((operation) => operation.type === "create");
  if (creates.length > 0) {
    lines.push("CREATE");
    for (const operation of creates) {
      lines.push(`  ${operation.path}`);
      if (operation.summary) lines.push(`    + ${operation.summary}`);
    }
    lines.push("");
  }

  const patches = plan.operations.filter((operation) => operation.type === "patch");
  if (patches.length > 0) {
    lines.push("PATCH");
    for (const [index, operation] of patches.entries()) {
      if (index > 0) lines.push("");
      lines.push(`  ${operation.path}`);
      lines.push(`    + ${operation.summary}`);
    }
    lines.push("");
  }

  if (plan.unchanged.length > 0) {
    lines.push("UNCHANGED");
    for (const entry of plan.unchanged) {
      lines.push(`  ${entry.path}  (${entry.reason})`);
    }
    lines.push("");
  }

  if (plan.conflicts.length > 0) {
    lines.push("CONFLICTS");
    for (const conflict of plan.conflicts) {
      lines.push(`  ${conflict.path ?? "repository"}`);
      lines.push(`    ! ${conflict.message}`);
      if (conflict.details) lines.push(`      ${conflict.details}`);
    }
    lines.push("");
  }

  if (plan.operations.length === 0 && plan.conflicts.length === 0) {
    lines.push("Nothing to do. The repository context is already initialized.");
    lines.push("");
  }

  return lines.join("\n");
}
