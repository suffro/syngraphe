---
title: Quickstart
description: Initialize a repository, fill in the context, and verify it — in about five minutes.
order: 4
---

# Quickstart

This walks through a first run on a repository you already have. Nothing is written until step 2,
and you will have seen the exact plan before it is.

## 1. Install Syngraphe

```bash
npm install -g syngraphe
```

For more details checkout the [installation page](/getting-started/installation).

## 2. See the plan

```bash
cd my-project
syngraphe init --dry-run
```

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

- **CREATE** lists files that do not exist yet. Existing files are never listed there.
- **PATCH** shows which files gain a managed block. Only the block is added; the rest of the file
  is untouched.
- **UNCHANGED** is what Syngraphe found and deliberately left alone.

`--dry-run` builds the same plan the real run applies. It is not a separate code path.

## 3. Apply it

```bash
syngraphe init
```

The output is the same plan, followed by `9 files written.` Now look at the diff:

```bash
git diff
```

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
```

Additive, small, and reviewable. That is the whole change to your existing files.

## 4. Write the context

The generated templates are headings and nothing else — deliberately, so nobody is tempted to leave
generated prose in place. Start with two files:

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

## 4. Check it

```bash
syngraphe check
```

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

Before you fill `state/current.md`, the last line will instead be a `STATE002` warning saying the
file contains only headings — that is the tool asking you to finish the job, not an error.

## 5. Commit

```bash
git add .context AGENTS.md CLAUDE.md
git commit -m "Add repository context"
```

From here the context is ordinary repository content: reviewed in pull requests, versioned by Git,
and read by anyone — or anything — that opens the repository.

## 6. Wire it into CI (optional)

```yaml
- run: npx syngraphe check --strict
```

`--strict` makes warnings fail the build too. See
[continuous integration](/guides/continuous-integration) for the exit codes and the JSON output.

## What to read next

- [Writing the context](/guides/writing-the-context) — what goes in each file.
- [Agent integrations](/guides/agent-integrations) — how each agent finds the context.
- [CLI reference](/reference/cli) — every command and flag.
