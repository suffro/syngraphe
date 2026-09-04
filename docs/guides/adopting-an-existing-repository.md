---
title: Adopting an existing repository
description: Introducing Syngraphe into a repository that already has an AGENTS.md, a CLAUDE.md, vendor rules, or its own .context directory.
order: 1
---

# Adopting an existing repository

A fresh repository is the easy case. This page is about the other ones: files that already exist,
conventions that are already in place, and directories that happen to share a name.

## Start with the plan

Always:

```bash
syngraphe init --dry-run
```

The plan is the contract. Whatever it lists is exactly what the real run will do, because
`--dry-run` and the real run share one planner. Reading it takes ten seconds and removes every
surprise.

## An existing `AGENTS.md`

Syngraphe is deliberately conservative with this file. It:

- never replaces existing content;
- never reformats the file;
- never reorders anything;
- inserts one managed block and nothing else.

Placement follows two rules:

1. if the file begins with a top-level `# Heading`, the block goes immediately after it;
2. otherwise the block goes at the very top.

Everything else is preserved byte for byte — including CRLF line endings and a missing final
newline. The insertion is exactly reversible: remove the block and the file is what it was, to the
byte. See [managed blocks](/reference/managed-blocks) for the mechanics.

If `AGENTS.md` does not exist, it is created containing only the managed block. No heading, no
invented prose: the file is yours to grow from there.

## An existing `CLAUDE.md`

Four cases, all handled without asking:

| Situation                                   | What happens                                          |
| ------------------------------------------- | ----------------------------------------------------- |
| No `CLAUDE.md`                              | Created, containing the managed `@AGENTS.md` import.  |
| Has content, no import                      | The import block is inserted; your content is kept.   |
| Already imports `AGENTS.md` on its own line | Left completely alone.                                |
| Is a symlink to `AGENTS.md`                 | Left completely alone.                                |

A `CLAUDE.md` that is a symlink pointing at something *other* than `AGENTS.md` is also left alone —
Syngraphe never writes through a symlink — and reported as a `CLAUDE005` warning so the situation is
visible rather than silent.

## Existing vendor configuration

`.cursor/rules/`, `.cursorrules`, `.codex/` and similar files are detected and reported under
`UNCHANGED`. They are never read, rewritten, or translated. Cursor and Codex read `AGENTS.md`
natively, so there is nothing to add for them; see [agent integrations](/guides/agent-integrations).

## An existing `.context/` directory

This is the one case where Syngraphe refuses to act. The directory is classified first:

| Classification         | Meaning                                                       | `init` behaviour                                  |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| **valid**              | Syngraphe context, supported schema, all expected files present | Nothing to do.                                    |
| **partial**            | Recognisably Syngraphe, some files missing                    | Creates only the missing files.                   |
| **unsupported schema** | Manifest declares a schema this build does not know           | Aborts with [exit code 3](/reference/exit-codes). |
| **invalid manifest**   | `manifest.json` is not valid JSON, or has no `schemaVersion`  | Aborts with exit code 1.                          |
| **unrelated**          | A `.context/` that is not Syngraphe's                         | Aborts with exit code 1, explains the conflict.   |

The unrelated case looks like this:

```text
.context/ already exists and is not a Syngraphe repository context.
.context/ exists, has no .context/manifest.json, and contains unrelated entries: notes.txt.
Syngraphe will not modify it. Move or rename it, then re-run.
```

Nothing is written, nothing is merged, and no assumption is made about what those files are for.

## What a partial run looks like

If someone deleted `.context/state/current.md`, or a merge dropped it, `init` puts back exactly what
is missing:

```text
Syngraphe initialization

CREATE
  .context/state/current.md

UNCHANGED
  AGENTS.md  (already up to date)
  CLAUDE.md  (already up to date)

1 file written.
```

Existing files are never rewritten to match the templates. Your content stays yours.

## When init refuses because of a conflict

If a managed block was hand-edited, duplicated, or left with unbalanced markers, `init` renders the
conflict and stops **without writing anything at all**:

```text
CONFLICTS
  AGENTS.md
    ! The Syngraphe block in AGENTS.md was modified manually.
      Syngraphe will not overwrite it. Restore the expected content or remove the block and re-run
      initialization.
```

This is deliberate: a partially applied plan is harder to reason about than one that did not run.
Fix the block — or delete it entirely and let `init` reinstate it — then run again.
[Troubleshooting](/guides/troubleshooting) covers each conflict in turn.

## Running it twice

Initialization is idempotent. A second run on an initialized repository reports:

```text
Syngraphe initialization

UNCHANGED
  .context/  (already initialized)
  AGENTS.md  (already up to date)
  CLAUDE.md  (already up to date)

Nothing to do. The repository context is already initialized.
```

No file is touched, so the second run leaves no diff. That property is covered by a test, not by
convention.

## Suggested rollout

1. Run `--dry-run` and read the plan.
2. Run `init` on a branch.
3. Fill `truth/architecture.md` and `state/current.md` with real content — an empty context is worse
   than none, because it invites trust it has not earned.
4. Open the pull request. The `.context/` diff is part of the review.
5. Add `syngraphe check --strict` to CI once the context is real.
