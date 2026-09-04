/**
 * Factory for agents that read `AGENTS.md` natively.
 *
 * Such an agent needs no file of its own, so the integration only detects
 * vendor configuration in order to report it. Syngraphe is not a rule
 * transpiler: whatever it detects here, it leaves untouched.
 */

import { emptyPlan, type Plan } from "../../core/plan.ts";
import type { Repository } from "../../core/repository.ts";
import { AGENTS_FILE } from "../../templates/agents.ts";
import type { AgentDetection, AgentIntegration, AgentIntegrationState } from "../types.ts";

export interface NativeIntegrationOptions {
  id: string;
  displayName: string;
  /** Vendor-specific paths that indicate the agent is used in this repository. */
  evidencePaths: string[];
}

export function createNativeIntegration(options: NativeIntegrationOptions): AgentIntegration {
  async function detect(repository: Repository): Promise<AgentDetection> {
    const evidence: string[] = [];
    for (const candidate of options.evidencePaths) {
      const path = candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
      if ((await repository.kind(path)) !== "missing") evidence.push(candidate);
    }
    return { present: evidence.length > 0, evidence };
  }

  return {
    id: options.id,
    displayName: options.displayName,

    detect,

    async inspect(repository: Repository): Promise<AgentIntegrationState> {
      const detection = await detect(repository);
      return {
        status: "native",
        files: detection.evidence,
        message: null,
        details: `${options.displayName} reads ${AGENTS_FILE} directly.`,
      };
    },

    async planIntegration(repository: Repository): Promise<Plan> {
      const plan = emptyPlan();
      const detection = await detect(repository);
      for (const path of detection.evidence) {
        plan.unchanged.push({ path, reason: "vendor configuration, left untouched" });
      }
      return plan;
    },
  };
}
