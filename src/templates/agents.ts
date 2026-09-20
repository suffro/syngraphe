/**
 * Managed-block bodies Syngraphe writes into agent bootstrap files.
 *
 * These strings are the canonical expected content: initialization writes
 * them, and checks compare against them to detect drift. Changing them changes
 * what every repository is checked against, so treat them as a contract.
 */

export const AGENTS_FILE = "AGENTS.md";
export const CLAUDE_FILE = "CLAUDE.md";

const MANAGED_NOTICE = "<!-- Managed by Syngraphe. Do not edit this block manually. -->";

/**
 * The policy reference is unconditional text about a conditional file.
 *
 * Deriving the body from whether `AGENT-POLICY.md` exists would make creating
 * or deleting that file turn an untouched block into drift, which Syngraphe
 * reports and refuses to repair. One constant body keeps the block a single
 * comparable contract, in the same "if it is there, use it" shape the
 * `syngraphe check` line already has.
 */
export const AGENTS_MANAGED_BODY = `${MANAGED_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.
If \`AGENT-POLICY.md\` is present, read it before planning multi-step or expensive work.`;

export const CLAUDE_MANAGED_BODY = `${MANAGED_NOTICE}
@${AGENTS_FILE}`;

/** Scoped bootstraps stay relocatable and do not embed shell-escaped filesystem paths. */
export function agentsManagedBody(scope = "."): string {
  if (scope === ".") return AGENTS_MANAGED_BODY;
  return `${MANAGED_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.
If an \`AGENT-POLICY.md\` is present in this repository, read it before planning multi-step or
expensive work.`;
}

/**
 * Bodies earlier Syngraphe versions wrote, kept verbatim.
 *
 * A block matching one of these was written by Syngraphe and edited by nobody,
 * so updating it in place loses nothing — that is what separates an outdated
 * block from drift. Entries are never removed once published: dropping one
 * turns every repository still carrying it into an unrepairable drift report.
 * Both scope variants live in one list on purpose, so a directory that became
 * a scope (or stopped being one) is brought to the body its current shape
 * expects instead of being reported as hand-edited.
 */
export const SUPERSEDED_AGENTS_BODIES: readonly string[] = [
  // 0.4.0 and earlier: before the AGENT-POLICY.md reference.
  `${MANAGED_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.`,
  `${MANAGED_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.`,
];
