import type { Output } from "../cli/output.ts";
import { SyngrapheError } from "../core/errors.ts";
import { EXIT_USAGE } from "../core/exit-codes.ts";
import type { Plan } from "../core/plan.ts";
import { planToJson } from "../core/plan-json.ts";
import { renderPlan } from "../core/render-plan.ts";

export function validatePlanOutputOptions(options: { dryRun: boolean; json: boolean }): void {
  if (options.json && !options.dryRun) {
    throw new SyngrapheError("--json requires --dry-run for mutating commands.", EXIT_USAGE);
  }
}

export function writePlanOutput(options: {
  output: Output;
  plan: Plan;
  scope: string;
  title: string;
  json: boolean;
}): void {
  options.output.write(
    options.json
      ? JSON.stringify(planToJson(options.plan, options.scope), null, 2)
      : renderPlan(options.plan, options.title),
  );
}
