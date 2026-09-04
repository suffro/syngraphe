import { checks as defaultChecks } from "./registry.ts";
import type { Check, CheckContext, Finding } from "./types.ts";

export interface CheckResult {
  check: Check;
  findings: Finding[];
}

export interface CheckRun {
  results: CheckResult[];
  findings: Finding[];
  errors: number;
  warnings: number;
}

export async function runChecks(
  context: CheckContext,
  registry: readonly Check[] = defaultChecks,
): Promise<CheckRun> {
  const results: CheckResult[] = [];
  const findings: Finding[] = [];

  for (const check of registry) {
    const checkFindings = await check.run(context);
    results.push({ check, findings: checkFindings });
    findings.push(...checkFindings);
  }

  return {
    results,
    findings,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
  };
}
