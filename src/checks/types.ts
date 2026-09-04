/**
 * The deterministic check framework.
 *
 * Checks are offline, read-only and side-effect free. They receive a prepared
 * context and return findings; they never print, never write, and never decide
 * the exit code.
 */

import type { AgentIntegration, AgentIntegrationState } from "../agents/types.ts";
import type { Repository } from "../core/repository.ts";
import type { ContextInspection } from "../inspectors/context.ts";
import type { ManagedFileState } from "../managed/file.ts";

export type Severity = "error" | "warning" | "info";

export type CheckCategory = "manifest" | "structure" | "references" | "agents" | "state";

export interface Finding {
  /** Stable, documented identifier. Never renumbered. */
  code: string;
  severity: Severity;
  category: CheckCategory;
  message: string;
  /** Repository-relative path the finding is about. */
  file?: string;
  /** 1-based line number, when the finding points at one. */
  line?: number;
  details?: string;
}

export interface AgentSnapshot {
  integration: AgentIntegration;
  detection: { present: boolean; evidence: string[] };
  state: AgentIntegrationState;
}

export interface CheckContext {
  repository: Repository;
  context: ContextInspection;
  agentsBootstrap: ManagedFileState;
  agents: AgentSnapshot[];
  /** Reference instant for age-based checks; injected so tests stay deterministic. */
  now: Date;
}

export interface Check {
  id: string;
  /** Label used in human-readable output. */
  label: string;
  category: CheckCategory;
  run(context: CheckContext): Promise<Finding[]>;
}
