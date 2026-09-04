/**
 * The agent-integration contract.
 *
 * An integration describes how one coding agent discovers repository context.
 * It never decides policy: it inspects, and it produces plans that the calling
 * command renders and applies. Agent-specific knowledge lives in adapters
 * under `integrations/`, never in core or in commands.
 *
 * A future `AgentRunner` — asking an installed agent to perform semantic
 * analysis — is a separate concern and must not be folded into this one.
 */

import type { Plan } from "../core/plan.ts";
import type { Repository } from "../core/repository.ts";
import type { ManagedFileStatus } from "../managed/file.ts";

export interface AgentDetection {
  /** Whether this agent appears to be used in the repository. */
  present: boolean;
  /** Repository-relative paths that led to the conclusion. */
  evidence: string[];
}

/**
 * The managed-file statuses plus two agent-level ones:
 * `native` for agents that read `AGENTS.md` directly and have no file to
 * manage, and `skipped` for a user setup Syngraphe deliberately leaves alone.
 */
export type AgentIntegrationStatus = ManagedFileStatus | "native" | "skipped";

export interface AgentIntegrationState {
  status: AgentIntegrationStatus;
  /** Files this state was derived from. */
  files: string[];
  /** Human-readable explanation for every status except `ready` and `native`. */
  message: string | null;
  /** Extra context for the explanation, when useful. */
  details: string | null;
}

export interface AgentFindingCodes {
  missing: string;
  drift: string;
  duplicate: string;
  malformed: string;
  conflict: string;
}

export interface AgentIntegration {
  id: string;
  displayName: string;
  /**
   * Stable finding codes for this integration. Omitted by integrations that
   * cannot fail, such as native `AGENTS.md` consumers.
   */
  findingCodes?: AgentFindingCodes;

  detect(repository: Repository): Promise<AgentDetection>;
  inspect(repository: Repository): Promise<AgentIntegrationState>;
  planIntegration(repository: Repository): Promise<Plan>;
}
