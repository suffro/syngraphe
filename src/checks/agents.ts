import type { AgentIntegration } from "../agents/types.ts";
import type { ManagedFileState } from "../managed/file.ts";
import { AGENTS_FILE } from "../templates/agents.ts";
import type { Check, Finding, Severity } from "./types.ts";

/** Stable codes for the canonical `AGENTS.md` bootstrap. */
const AGENTS_CODES = {
  missing: "AGENT001",
  drift: "AGENT002",
  duplicate: "AGENT003",
  malformed: "AGENT004",
  conflict: "AGENT005",
} as const;

/** The `AGENTS.md` managed block is present, unique and unmodified. */
export const agentsBootstrapCheck: Check = {
  id: "agents-md",
  label: AGENTS_FILE,
  category: "agents",

  async run(context) {
    const findings: Finding[] = [];
    // Before initialization the missing bootstrap is not a separate problem.
    if (context.context.status === "absent") return findings;

    const state = context.agentsBootstrap;
    if (state.status === "ready") return findings;

    findings.push({
      code: AGENTS_CODES[state.status],
      severity: "error",
      category: "agents",
      file: AGENTS_FILE,
      message: state.message ?? `${AGENTS_FILE} integration is not valid.`,
      ...lineOf(state),
      ...(state.details ? { details: state.details } : {}),
    });
    return findings;
  },
};

/**
 * One check per agent integration that can actually fail. Native integrations
 * write nothing and therefore report nothing.
 */
export function createIntegrationCheck(integration: AgentIntegration): Check {
  return {
    id: `agent-${integration.id}`,
    label: `${integration.displayName} integration`,
    category: "agents",

    async run(context) {
      const findings: Finding[] = [];
      const codes = integration.findingCodes;
      if (!codes) return findings;
      if (context.context.status === "absent") return findings;

      const snapshot = context.agents.find((entry) => entry.integration.id === integration.id);
      if (!snapshot) return findings;

      const { state, detection } = snapshot;
      if (state.status === "ready" || state.status === "native") return findings;

      // An agent that is not used in this repository needs no integration.
      if (state.status === "missing" && !detection.present) return findings;

      const severity: Severity =
        state.status === "missing" || state.status === "skipped" ? "warning" : "error";
      const code = state.status === "skipped" ? codes.conflict : codes[state.status];

      findings.push({
        code,
        severity,
        category: "agents",
        file: state.files[0] ?? undefined,
        message: state.message ?? `${integration.displayName} integration is not valid.`,
        ...(state.details ? { details: state.details } : {}),
      });
      return findings;
    },
  };
}

function lineOf(state: ManagedFileState): { line?: number } {
  const block = state.block;
  if (!block) return {};
  if (block.status === "drift" || block.status === "unsupported-version") {
    return { line: block.block.startLine + 1 };
  }
  if (block.status === "duplicate") {
    const second = block.blocks[1];
    return second ? { line: second.startLine + 1 } : {};
  }
  if (block.status === "malformed") return { line: block.line };
  return {};
}
