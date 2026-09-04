/**
 * `AGENTS.md` bootstrap.
 *
 * `AGENTS.md` is not owned by any single agent: it is the canonical entry
 * point every agent is expected to read, so it lives here rather than in an
 * adapter. Syngraphe owns only the text between its markers.
 */

import type { Plan } from "../core/plan.ts";
import type { Repository } from "../core/repository.ts";
import { inspectManagedFile, type ManagedFileState, planManagedFile } from "../managed/file.ts";
import { AGENTS_FILE, AGENTS_MANAGED_BODY } from "../templates/agents.ts";

export const AGENTS_PATCH_SUMMARY = "Syngraphe repository-context bootstrap";

export async function inspectAgentsBootstrap(repository: Repository): Promise<ManagedFileState> {
  return inspectManagedFile(repository, AGENTS_FILE, AGENTS_MANAGED_BODY);
}

export function planAgentsBootstrap(state: ManagedFileState): Plan {
  return planManagedFile(state, AGENTS_MANAGED_BODY, AGENTS_PATCH_SUMMARY);
}
