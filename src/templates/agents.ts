/**
 * Managed-block bodies Syngraphe writes into agent bootstrap files.
 *
 * These strings are the canonical expected content: initialization writes
 * them, and checks compare against them to detect drift. Changing them changes
 * what every repository is checked against, so treat them as a contract.
 */

export const AGENTS_FILE = "AGENTS.md";
export const CLAUDE_FILE = "CLAUDE.md";

/**
 * The generation of managed bodies this build writes.
 *
 * Every canonical body declares it in its notice line, so a build meeting a
 * body that declares a later revision can say "written by a newer Syngraphe"
 * instead of calling it a manual edit it cannot repair. Bump it whenever any
 * canonical body changes, and append the previous bodies to the superseded
 * lists in the same change.
 *
 * The revision lives in the body, not in the start marker: every released
 * parser matches the marker exactly, so an extra attribute would turn each
 * block into an orphan end marker for them.
 */
export const MANAGED_BODY_REVISION = 1;

const MANAGED_NOTICE = `<!-- Managed by Syngraphe (revision ${MANAGED_BODY_REVISION}). Do not edit this block manually. -->`;

/**
 * The notice bodies carried before they declared a revision (0.1.0–0.4.1).
 * Superseded bodies must keep it verbatim; interpolating `MANAGED_NOTICE`
 * there would silently reword bodies already committed in repositories.
 */
const UNREVISIONED_NOTICE = "<!-- Managed by Syngraphe. Do not edit this block manually. -->";

const REVISION_PATTERN = /^<!--\s*Managed by Syngraphe \(revision (\d{1,9})\)/;

/** The revision a managed body declares in its first line, or null when it declares none. */
export function declaredBodyRevision(body: string): number | null {
  const firstLine = body.replace(/^\s+/, "").split("\n", 1)[0] ?? "";
  const match = REVISION_PATTERN.exec(firstLine);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/**
 * Whether a body declares a revision later than this build knows.
 *
 * Only a deliberate edit of the number can make a hand-edited body pass as
 * newer; an accidental one cannot, which is the case drift reporting exists for.
 */
export function isNewerManagedBody(body: string): boolean {
  const revision = declaredBodyRevision(body);
  return revision !== null && revision > MANAGED_BODY_REVISION;
}

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
  `${UNREVISIONED_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.`,
  `${UNREVISIONED_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.`,
  // 0.4.1: with the AGENT-POLICY.md reference, before bodies declared a revision.
  `${UNREVISIONED_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.
If \`AGENT-POLICY.md\` is present, read it before planning multi-step or expensive work.`,
  `${UNREVISIONED_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.
If an \`AGENT-POLICY.md\` is present in this repository, read it before planning multi-step or
expensive work.`,
];

/** Bodies earlier Syngraphe versions wrote into `CLAUDE.md`, under the same rules. */
export const SUPERSEDED_CLAUDE_BODIES: readonly string[] = [
  // 0.1.0–0.4.1: before bodies declared a revision.
  `${UNREVISIONED_NOTICE}
@${AGENTS_FILE}`,
];
