/**
 * Claude Code integration: a compatibility shim, nothing more.
 *
 * Claude reads `CLAUDE.md`, so the only thing Syngraphe adds is an import of
 * `AGENTS.md`. Any repository that already points Claude at `AGENTS.md` — by
 * import or by symlink — is left exactly as it is.
 */

import { emptyPlan, type Plan } from "../../core/plan.ts";
import type { Repository } from "../../core/repository.ts";
import { toLf } from "../../core/text.ts";
import { inspectManagedFile, planManagedFile } from "../../managed/file.ts";
import { AGENTS_FILE, CLAUDE_FILE, CLAUDE_MANAGED_BODY } from "../../templates/agents.ts";
import type { AgentDetection, AgentIntegration, AgentIntegrationState } from "../types.ts";

export const CLAUDE_PATCH_SUMMARY = `@${AGENTS_FILE} compatibility import`;

const CLAUDE_DIRECTORY = ".claude";

/** An `@AGENTS.md` import on a line of its own, with or without a `./` prefix. */
const IMPORT_PATTERN = new RegExp(`^\\s*@\\.?/?${AGENTS_FILE.replace(".", "\\.")}\\s*$`, "m");

export const claudeIntegration: AgentIntegration = {
  id: "claude",
  displayName: "Claude",

  findingCodes: {
    missing: "CLAUDE001",
    drift: "CLAUDE002",
    duplicate: "CLAUDE003",
    malformed: "CLAUDE004",
    conflict: "CLAUDE005",
  },

  async detect(repository: Repository): Promise<AgentDetection> {
    const evidence: string[] = [];
    if ((await repository.kind(CLAUDE_FILE)) !== "missing") evidence.push(CLAUDE_FILE);
    if ((await repository.kind(CLAUDE_DIRECTORY)) === "directory") {
      evidence.push(`${CLAUDE_DIRECTORY}/`);
    }
    return { present: evidence.length > 0, evidence };
  },

  async inspect(repository: Repository): Promise<AgentIntegrationState> {
    const kind = await repository.kind(CLAUDE_FILE);

    if (kind === "symlink") {
      const target = await repository.realPath(CLAUDE_FILE);
      const agents = await repository.realPath(AGENTS_FILE);
      if (target !== null && agents !== null && target === agents) {
        return ready([CLAUDE_FILE], `${CLAUDE_FILE} is a symlink to ${AGENTS_FILE}.`);
      }
      return {
        status: "skipped",
        files: [CLAUDE_FILE],
        message: `${CLAUDE_FILE} is a symlink that does not point at ${AGENTS_FILE}.`,
        details: `Syngraphe does not write through symlinks. Point it at ${AGENTS_FILE}, or import ${AGENTS_FILE} from its target.`,
      };
    }

    const fileState = await inspectManagedFile(repository, CLAUDE_FILE, CLAUDE_MANAGED_BODY);

    // A hand-written import is a correct integration; do not add a second one.
    if (
      fileState.status === "missing" &&
      fileState.content !== null &&
      IMPORT_PATTERN.test(toLf(fileState.content))
    ) {
      return ready([CLAUDE_FILE], `${CLAUDE_FILE} already imports ${AGENTS_FILE}.`);
    }

    return {
      status: fileState.status,
      files: [CLAUDE_FILE],
      message: fileState.message,
      details: fileState.details,
    };
  },

  async planIntegration(repository: Repository): Promise<Plan> {
    const state = await this.inspect(repository);

    if (state.status === "ready" || state.status === "native" || state.status === "skipped") {
      const plan = emptyPlan();
      plan.unchanged.push({
        path: CLAUDE_FILE,
        reason: state.message ?? state.details ?? "already up to date",
      });
      return plan;
    }

    if (state.status !== "missing") {
      const plan = emptyPlan();
      plan.conflicts.push({
        path: CLAUDE_FILE,
        message: state.message ?? `${CLAUDE_FILE} cannot be updated safely.`,
        details: state.details,
      });
      return plan;
    }

    const fileState = await inspectManagedFile(repository, CLAUDE_FILE, CLAUDE_MANAGED_BODY);
    return planManagedFile(fileState, CLAUDE_MANAGED_BODY, CLAUDE_PATCH_SUMMARY);
  },
};

function ready(files: string[], details: string): AgentIntegrationState {
  return { status: "ready", files, message: null, details };
}
