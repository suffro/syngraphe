/**
 * Builds the shared, read-only snapshot every check runs against.
 *
 * Gathering happens once so that a single run is internally consistent and so
 * that checks cannot accidentally re-read a repository that changed underneath
 * them.
 */

import { inspectAgentsBootstrap } from "../agents/agents-md.ts";
import { agentIntegrations } from "../agents/registry.ts";
import type { Repository } from "../core/repository.ts";
import { inspectContext } from "../inspectors/context.ts";
import type { AgentSnapshot, CheckContext } from "./types.ts";

export interface CheckContextOptions {
  now?: Date;
}

export async function createCheckContext(
  repository: Repository,
  options: CheckContextOptions = {},
): Promise<CheckContext> {
  const context = await inspectContext(repository);
  const agentsBootstrap = await inspectAgentsBootstrap(repository);

  const agents: AgentSnapshot[] = [];
  for (const integration of agentIntegrations) {
    agents.push({
      integration,
      detection: await integration.detect(repository),
      state: await integration.inspect(repository),
    });
  }

  return {
    repository,
    context,
    agentsBootstrap,
    agents,
    now: options.now ?? new Date(),
  };
}
