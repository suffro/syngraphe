/**
 * The files `syngraphe init` creates, and the schema they declare.
 *
 * Templates stay intentionally small: they are starting points for humans to
 * fill in, not questionnaires. The repository must remain readable and useful
 * without Syngraphe installed, so every generated file is plain Markdown apart
 * from the manifest.
 */

export const CONTEXT_SCHEMA_VERSION = 1;
export const CONTEXT_LAYOUT = "standard";

export const CONTEXT_DIRECTORY = ".context";

export const MANIFEST_PATH = `${CONTEXT_DIRECTORY}/manifest.json`;
export const INDEX_PATH = `${CONTEXT_DIRECTORY}/index.md`;
export const ARCHITECTURE_PATH = `${CONTEXT_DIRECTORY}/truth/architecture.md`;
export const CONVENTIONS_PATH = `${CONTEXT_DIRECTORY}/truth/conventions.md`;
export const CURRENT_STATE_PATH = `${CONTEXT_DIRECTORY}/state/current.md`;
export const DECISIONS_README_PATH = `${CONTEXT_DIRECTORY}/decisions/README.md`;
export const HISTORY_README_PATH = `${CONTEXT_DIRECTORY}/history/README.md`;

export const DECISIONS_DIRECTORY = `${CONTEXT_DIRECTORY}/decisions`;
export const HISTORY_DIRECTORY = `${CONTEXT_DIRECTORY}/history`;

/** Directory entries a Syngraphe-managed `.context/` is expected to contain. */
export const CONTEXT_ENTRIES = [
  "manifest.json",
  "index.md",
  "truth",
  "state",
  "decisions",
  "history",
];

export interface ContextTemplate {
  path: string;
  contents: string;
}

const MANIFEST_CONTENTS = `${JSON.stringify(
  { schemaVersion: CONTEXT_SCHEMA_VERSION, layout: CONTEXT_LAYOUT },
  null,
  2,
)}\n`;

const INDEX_CONTENTS = `# Repository Context

This directory contains the canonical shared context for this repository.

## Always relevant

- \`truth/architecture.md\` — current system architecture.
- \`state/current.md\` — current project state and active work.

## When relevant

- \`truth/conventions.md\` — repository conventions.
- \`decisions/\` — significant technical and architectural decisions.

## Historical

- \`history/\` — completed, historical, or superseded operational context.
`;

const ARCHITECTURE_CONTENTS = `# Architecture

## Overview

## Major components

## Data flow

## External systems

## Important constraints
`;

const CONVENTIONS_CONTENTS = `# Conventions

## Repository conventions

## Development workflow

## Important rules
`;

const CURRENT_STATE_CONTENTS = `# Current State

## Current focus

## Recent relevant changes

## Next

## Blockers
`;

const DECISIONS_README_CONTENTS = `# Decisions

Significant technical and architectural decisions, one Markdown file each.

Record what was decided, why, and what was rejected.
`;

const HISTORY_README_CONTENTS = `# History

Completed, historical, or superseded operational context, one Markdown file each.

Move context here instead of deleting it when it stops being current.
`;

/** Every file created by initialization, in the order it is reported. */
export const CONTEXT_TEMPLATES: readonly ContextTemplate[] = [
  { path: MANIFEST_PATH, contents: MANIFEST_CONTENTS },
  { path: INDEX_PATH, contents: INDEX_CONTENTS },
  { path: ARCHITECTURE_PATH, contents: ARCHITECTURE_CONTENTS },
  { path: CONVENTIONS_PATH, contents: CONVENTIONS_CONTENTS },
  { path: CURRENT_STATE_PATH, contents: CURRENT_STATE_CONTENTS },
  { path: DECISIONS_README_PATH, contents: DECISIONS_README_CONTENTS },
  { path: HISTORY_README_PATH, contents: HISTORY_README_CONTENTS },
];

/** Context files whose absence is a structural error after initialization. */
export const REQUIRED_CONTEXT_FILES: readonly string[] = CONTEXT_TEMPLATES.map(
  (template) => template.path,
);
