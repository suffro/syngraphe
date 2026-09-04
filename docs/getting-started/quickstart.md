---
title: Quickstart
description: Initialize a repository, fill in the context, and verify it — in about five minutes.
order: 4
---

# Quickstart

A first run on a repository you already have, in two routes. **Quick** is the shortest sequence that
leaves a working, committed context. **Guided** is the same run with the plan previewed before
anything is written and the diff read afterwards — take it if this is a repository you would rather
not surprise.

Both end in the same place. Neither invents anything about your project: everything Syngraphe writes
is listed in [what `init` writes](#what-init-writes).

## Install

```bash
npm install -g syngraphe
```

`npx`, project-local and from-source installs are on the
[installation page](/getting-started/installation).

## Run it

<Tabs :titles="['Quick', 'Guided']" label="Quickstart route">
<Tab title="Quick">

#### 1. Initialize

```bash
cd my-project
syngraphe init
```

<ExampleNote label="Actual output">Printed by <code>syngraphe init</code> in a repository that has no <code>AGENTS.md</code> or <code>CLAUDE.md</code> yet.</ExampleNote>

```text
Syngraphe initialization

CREATE
  .context/manifest.json
  .context/index.md
  .context/truth/architecture.md
  .context/truth/conventions.md
  .context/state/current.md
  .context/decisions/README.md
  .context/history/README.md
  AGENTS.md
    + Syngraphe repository-context bootstrap
  CLAUDE.md
    + @AGENTS.md compatibility import

9 files written.
```

#### 2. Write the context

The generated documents are headings and nothing else. That is deliberate: Syngraphe knows nothing
about your repository, and generated prose pretending otherwise is the exact failure the tool exists
to prevent.

<ExampleNote label="Generated">The whole of <code>.context/state/current.md</code> as <code>syngraphe init</code> writes it.</ExampleNote>

```md
# Current State

## Current focus

## Recent relevant changes

## Next

## Blockers
```

Open `.context/truth/architecture.md` and `.context/state/current.md` and fill the headings in.

<ExampleNote>Invented, to show the level of detail — not a template, and not written by any command.</ExampleNote>

```md
# Current State

## Current focus

Migrating billing off the legacy schema.

## Recent relevant changes

- `invoices` is now written by the worker, not the API.

## Next

- Backfill historical rows, then delete the legacy table.

## Blockers

- Waiting on the finance export before the backfill can run.
```

Keep the two directories apart: `truth/` is what stays true, `state/` is what is true this week. See
[writing the context](/guides/writing-the-context) for what belongs where.

#### 3. Check it, then commit

```bash
syngraphe check
git add .context AGENTS.md CLAUDE.md
git commit -m "Add repository context"
```

`check` verifies the manifest, the directory structure, every path referenced from `index.md`, and
both managed blocks. Until `state/current.md` says something, it ends on a `STATE002` warning that
the file contains only headings — the tool asking you to finish the job, not an error. It exits `0`.

From here the context is ordinary repository content: reviewed in pull requests, versioned by Git,
and read by anyone — or anything — that opens the repository.

</Tab>
<Tab title="Guided">

#### 1. See the plan first

```bash
cd my-project
syngraphe init --dry-run
```

<ExampleNote label="Actual output">Printed by <code>syngraphe init --dry-run</code> in a repository that already has <code>AGENTS.md</code>, <code>CLAUDE.md</code> and <code>.cursor/rules/</code>.</ExampleNote>

```text
Syngraphe initialization plan

CREATE
  .context/manifest.json
  .context/index.md
  .context/truth/architecture.md
  .context/truth/conventions.md
  .context/state/current.md
  .context/decisions/README.md
  .context/history/README.md

PATCH
  AGENTS.md
    + Syngraphe repository-context bootstrap

  CLAUDE.md
    + @AGENTS.md compatibility import

UNCHANGED
  .cursor/rules/  (vendor configuration, left untouched)

No files were modified.
```

Three things are worth noticing:

- **CREATE** lists files that do not exist yet. A file already present is never listed there.
- **PATCH** shows which existing files gain a managed block. Only the block is added; the rest of
  the file is untouched.
- **UNCHANGED** is what Syngraphe found and deliberately left alone — here, Cursor's own rule files,
  which belong to you.

`--dry-run` builds the same plan the real run applies. It is not a separate code path.

#### 2. Apply it

```bash
syngraphe init
```

The output is the same plan, with `9 files written.` in place of the last line. Now read the diff:

```bash
git diff
```

<ExampleNote label="Actual output">The complete change <code>init</code> made to an existing <code>AGENTS.md</code>.</ExampleNote>

```diff
 # AGENTS.md

+<!-- syngraphe:start version="1" -->
+<!-- Managed by Syngraphe. Do not edit this block manually. -->
+
+This repository maintains shared project context in `.context/`.
+
+Before substantial work, read `.context/index.md` and the relevant context documents.
+Keep that context accurate: when a change makes it out of date, update it in the same change.
+If Syngraphe is available, run `syngraphe check` before completing substantial work.
+<!-- syngraphe:end -->
+
 ## Build

 - npm run build
```

Additive, small, and reviewable. That is the whole change to your existing files, and re-running
`init` reproduces it rather than adding a second copy. See
[managed blocks](/reference/managed-blocks) for what happens when someone edits inside the markers.

#### 3. Write the context

The generated templates are headings and nothing else — deliberately, so nobody is tempted to leave
generated prose in place. Start with two files.

<ExampleNote>Invented content for both files, to show the level of detail. <code>syngraphe init</code> writes the headings and leaves them empty.</ExampleNote>

`.context/truth/architecture.md`

```md
# Architecture

## Overview

A Fastify API in front of PostgreSQL, plus a worker that drains the outbox table.

## Major components

- `src/api/` — HTTP layer. Thin: validation and serialization only.
- `src/domain/` — business rules. No framework imports here.
- `src/worker/` — outbox drain, at-least-once delivery.

## Important constraints

- The API must stay stateless: any instance may serve any request.
- The outbox is the only path for outbound events.
```

`.context/state/current.md`

```md
# Current State

## Current focus

Migrating billing off the legacy schema.

## Recent relevant changes

- `invoices` is now written by the worker, not the API.

## Next

- Backfill historical rows, then delete the legacy table.

## Blockers

- Waiting on the finance export before the backfill can run.
```

Keep the two apart: `truth/` is what stays true, `state/` is what is true this week. See
[writing the context](/guides/writing-the-context) for what belongs where.

#### 4. Check it

```bash
syngraphe check
```

<ExampleNote label="Actual output">Printed by <code>syngraphe check</code> once <code>state/current.md</code> has been filled in.</ExampleNote>

```text
Syngraphe context integrity

✓ manifest
✓ context structure
✓ internal references
✓ AGENTS.md
✓ Claude integration
✓ context state

No problems found.
```

Before you fill `state/current.md`, the last check reports a `STATE002` warning saying the file
contains only headings — that is the tool asking you to finish the job, not an error, and the
command still exits `0`.

#### 5. Commit

```bash
git add .context AGENTS.md CLAUDE.md
git commit -m "Add repository context"
```

From here the context is ordinary repository content: reviewed in pull requests, versioned by Git,
and read by anyone — or anything — that opens the repository.

#### 6. Wire it into CI

```yaml
- run: npx syngraphe check --strict
```

`--strict` makes warnings fail the build too. See
[continuous integration](/guides/continuous-integration) for the exit codes and the JSON output.

</Tab>
</Tabs>

## What `init` writes

Nine files, and nothing else. Seven are new files under `.context/`; two are the agent bootstrap
files, created if they are missing and patched with a single managed block if they already exist.

| Path | What is written into it |
| --- | --- |
| `.context/manifest.json` | `protocol`, `schemaVersion` and `layout` — three keys, listed in full below. |
| `.context/index.md` | The reading order, pointing at the files in this table. The one generated document that contains prose. |
| `.context/truth/architecture.md` | Empty headings: Overview · Major components · Data flow · External systems · Important constraints. |
| `.context/truth/conventions.md` | Empty headings: Repository conventions · Development workflow · Important rules. |
| `.context/state/current.md` | Empty headings: Current focus · Recent relevant changes · Next · Blockers. |
| `.context/decisions/README.md` | Two sentences saying what the directory is for. |
| `.context/history/README.md` | Two sentences saying what the directory is for. |
| `AGENTS.md` | One managed block pointing agents at `.context/`. Everything already in the file is preserved. |
| `CLAUDE.md` | One managed block containing `@AGENTS.md`, so Claude Code reads the same file every other agent does. |

<ExampleNote label="Generated">The complete manifest, byte for byte.</ExampleNote>

```json
{
  "protocol": "repository-context",
  "schemaVersion": 1,
  "layout": "standard"
}
```

<ExampleNote label="Generated">The whole of <code>.context/truth/architecture.md</code>. The other two documents under <code>truth/</code> and <code>state/</code> are the same shape: headings, no content.</ExampleNote>

```md
# Architecture

## Overview

## Major components

## Data flow

## External systems

## Important constraints
```

Nothing outside that list is created, moved or rewritten. Vendor configuration that Syngraphe
recognises — `.cursor/rules/`, `.cursorrules`, `.codex/` — is reported under **UNCHANGED** and never
written to; see [agent integrations](/guides/agent-integrations) for why.

## What to read next

- [Writing the context](/guides/writing-the-context) — what goes in each file.
- [Adopting an existing repository](/guides/adopting-an-existing-repository) — when the documents
  you need already exist somewhere else.
- [Agent integrations](/guides/agent-integrations) — how each agent finds the context.
- [CLI reference](/reference/cli) — every command and flag.
