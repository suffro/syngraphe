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

export const AGENTS_MANAGED_BODY = `${MANAGED_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.`;

export const CLAUDE_MANAGED_BODY = `${MANAGED_NOTICE}
@${AGENTS_FILE}`;
