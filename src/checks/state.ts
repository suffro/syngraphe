import { CURRENT_STATE_PATH } from "../templates/context.ts";
import type { Check, Finding } from "./types.ts";

/**
 * Days after which an untouched `state/current.md` is worth a second look.
 * Age alone is never treated as an error: it is a signal, not a verdict.
 */
export const STATE_FRESHNESS_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `state/current.md` still says something, and has not silently fallen behind. */
export const stateCheck: Check = {
  id: "context-state",
  label: "context state",
  category: "state",

  async run(context) {
    const findings: Finding[] = [];
    if (context.context.status === "absent" || context.context.status === "unrelated") {
      return findings;
    }

    const contents = await context.repository.read(CURRENT_STATE_PATH);
    if (contents === null) return findings;

    if (isEmptyState(contents)) {
      findings.push({
        code: "STATE002",
        severity: "warning",
        category: "state",
        file: CURRENT_STATE_PATH,
        message: "Current state contains only headings.",
        details: "Describe the current focus so the file is useful to humans and agents.",
      });
    }

    const freshness = await freshnessFinding(context.repository, context.now);
    if (freshness) findings.push(freshness);

    return findings;
  },
};

async function freshnessFinding(
  repository: { git: { lastModified(path: string): Promise<{ epochMs: number } | null> } },
  now: Date,
): Promise<Finding | null> {
  const stateCommit = await repository.git.lastModified(CURRENT_STATE_PATH);
  // Untracked, uncommitted, or no Git available: no honest claim can be made.
  if (stateCommit === null) return null;

  const days = Math.floor((now.getTime() - stateCommit.epochMs) / DAY_MS);
  if (days < STATE_FRESHNESS_DAYS) return null;

  // Only meaningful when the repository moved on without the context.
  const headCommit = await repository.git.lastModified(".");
  if (headCommit === null || headCommit.epochMs <= stateCommit.epochMs) return null;

  return {
    code: "STATE001",
    severity: "warning",
    category: "state",
    file: CURRENT_STATE_PATH,
    message: `${CURRENT_STATE_PATH} has not changed in ${days} days.`,
    details:
      "This may be intentional. Review whether it still reflects the current repository state.",
  };
}

function isEmptyState(contents: string): boolean {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .every((line) => line === "" || line.startsWith("#"));
}
