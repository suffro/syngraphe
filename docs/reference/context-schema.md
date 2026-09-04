---
title: Context schema v1
description: The manifest, the standard layout, and the exact files syngraphe init creates.
order: 2
---

# Context schema v1

## The manifest

`.context/manifest.json` is the only non-Markdown file in the context, and it is deliberately tiny:

```json
{
  "schemaVersion": 1,
  "layout": "standard"
}
```

| Field           | Type   | Meaning                                                       |
| --------------- | ------ | ------------------------------------------------------------- |
| `schemaVersion` | number | The layout contract this context follows. Currently always `1`. |
| `layout`        | string | The named arrangement of directories. Currently always `"standard"`. |

There are no timestamps, no machine identifiers, no tool versions, no agent or model names. Every
one of those would produce diff noise on each run and record something the repository does not need
to know. What is here is what a reader — or a future version of the tool — genuinely needs.

### Version handling

- `schemaVersion: 1` — supported.
- Any other number — `MANIFEST003`, and both `init` and `check` exit with
  [code 3](/reference/exit-codes). The fix is to upgrade Syngraphe, never to edit the number down.
- Not valid JSON, not an object, or no numeric `schemaVersion` — `MANIFEST002`, exit code 1.
- An unrecognised `layout` — `MANIFEST004`, a warning: the layout is a name for an arrangement, and
  an unknown one is worth mentioning without being fatal.

## The standard layout

```text
.context/
├── manifest.json          # schema version and layout
├── index.md               # router into the context
├── truth/
│   ├── architecture.md    # current system architecture
│   └── conventions.md     # repository conventions
├── state/
│   └── current.md         # current focus, recent changes, next steps, blockers
├── decisions/
│   └── README.md          # significant decisions, one Markdown file each
└── history/
    └── README.md          # completed or superseded operational context
```

Those seven files are what `init` creates and what `check` expects. A missing one is `CTX002`, and
re-running `init` recreates exactly what is absent without touching anything else.

Files you add — more documents under `truth/`, decision records, archived context — are yours.
Syngraphe never removes, rewrites or reorders them; it only follows the local references in them.

## How a `.context/` directory is classified

Before doing anything, Syngraphe decides what it is looking at:

| Classification         | Condition                                                                 |
| ---------------------- | ------------------------------------------------------------------------- |
| **absent**             | No `.context` path at all.                                                |
| **valid**              | Manifest present, schema supported, all seven files present.              |
| **partial**            | Recognisably Syngraphe (or an empty directory), some files missing.       |
| **unsupported schema** | Manifest parses, `schemaVersion` is not 1.                                |
| **invalid manifest**   | Manifest is not valid JSON, not an object, or has no numeric `schemaVersion`. |
| **unrelated**          | `.context` exists, has no manifest, and contains entries Syngraphe does not recognise — or is not a directory at all. |

Only **absent** and **partial** are written to. **Unrelated** aborts with an explanation and no
assumptions; see [adopting an existing repository](/guides/adopting-an-existing-repository).

## The generated templates

They are intentionally almost empty — headings, no prose. Generated filler would be trusted by a
reader who has no way to know a human never looked at it, and left in place far longer than it
deserves.

### `index.md`

```md
# Repository Context

This directory contains the canonical shared context for this repository.

## Always relevant

- `truth/architecture.md` — current system architecture.
- `state/current.md` — current project state and active work.

## When relevant

- `truth/conventions.md` — repository conventions.
- `decisions/` — significant technical and architectural decisions.

## Historical

- `history/` — completed, historical, or superseded operational context.
```

The grouping is by how often a document is worth reading, which is the question a reader arriving at
`.context/` actually has.

### `truth/architecture.md`

```md
# Architecture

## Overview

## Major components

## Data flow

## External systems

## Important constraints
```

### `truth/conventions.md`

```md
# Conventions

## Repository conventions

## Development workflow

## Important rules
```

### `state/current.md`

```md
# Current State

## Current focus

## Recent relevant changes

## Next

## Blockers
```

### `decisions/README.md` and `history/README.md`

Two short files explaining what belongs in each directory. They are excluded from the counts
`syngraphe status` reports, so a directory with only its README shows as `0`.

## References between documents

`syngraphe check` verifies that local paths mentioned in context Markdown resolve:

- **Markdown links** — `[text](path)` — resolve relative to the document, as Markdown requires.
- **Inline code** — `` `truth/architecture.md` `` — resolves relative to the document, and also
  from the repository root, because prose commonly quotes a repository-relative path.

Only references that look like paths are considered: they end with `.md` or `/`. Anchors, external
URLs and fenced code blocks are ignored. A reference that resolves neither way is `LINK001`.

## Compatibility

The schema version is what a future Syngraphe reads to know whether it can act. That is why the
manifest exists at all, and why `schemaVersion` is checked before anything else happens: a v0.1
build meeting a future layout stops with a clear message instead of half-understanding it.

Nothing else in the context is machine-parsed. The Markdown is for readers, and Syngraphe makes no
claim about its structure beyond the file names above.
