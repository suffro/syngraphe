/**
 * The check registry.
 *
 * Order is the order results are reported in. Checks that depend on the same
 * facts are kept independent: each decides on its own whether it has anything
 * to say.
 */

import { agentIntegrations } from "../agents/registry.ts";
import { agentsBootstrapCheck, createIntegrationCheck } from "./agents.ts";
import { manifestCheck } from "./manifest.ts";
import { referencesCheck } from "./references.ts";
import { stateCheck } from "./state.ts";
import { structureCheck } from "./structure.ts";
import type { Check } from "./types.ts";

export const checks: readonly Check[] = [
  manifestCheck,
  structureCheck,
  referencesCheck,
  agentsBootstrapCheck,
  ...agentIntegrations
    .filter((integration) => integration.findingCodes !== undefined)
    .map(createIntegrationCheck),
  stateCheck,
];
