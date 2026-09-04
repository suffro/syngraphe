/**
 * Public entry point.
 *
 * Syngraphe is primarily a CLI; these exports exist so the same deterministic
 * core can be reused programmatically, for example by future commands or by
 * integrations that want the check results without parsing terminal output.
 */

export { agentIntegrations } from "./agents/registry.ts";
export type { AgentIntegration, AgentIntegrationState } from "./agents/types.ts";
export { createCheckContext } from "./checks/context.ts";
export { checks } from "./checks/registry.ts";
export { runChecks } from "./checks/run.ts";
export type { Check, CheckContext, Finding, Severity } from "./checks/types.ts";
export { main } from "./cli/main.ts";
export type { Output } from "./cli/output.ts";
export { CHECK_JSON_VERSION, runCheck } from "./commands/check.ts";
export { planInitialization, runInit } from "./commands/init.ts";
export { runStatus } from "./commands/status.ts";
export { SyngrapheError } from "./core/errors.ts";
export * from "./core/exit-codes.ts";
export { applyPlan, emptyPlan, type FileOperation, type Plan } from "./core/plan.ts";
export { renderPlan } from "./core/render-plan.ts";
export { Repository } from "./core/repository.ts";
export { inspectContext } from "./inspectors/context.ts";
export {
  findManagedBlock,
  insertManagedBlock,
  MANAGED_BLOCK_VERSION,
  removeManagedBlock,
  renderManagedBlock,
  replaceManagedBlock,
  validateManagedBlock,
} from "./managed/block.ts";
export { inspectManagedFile, planManagedFile } from "./managed/file.ts";
export * from "./templates/context.ts";
