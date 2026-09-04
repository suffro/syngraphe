---
title: Checks and findings
description: Every check Syngraphe runs, every finding code it can emit, and what each one means.
order: 4
---

# Checks and findings

Every check is deterministic, offline and read-only. Nothing here writes a file, calls a model, or
touches the network.

## The checks

They run in this order, and each prints one line in human output:

| Check                 | Category     | Verifies                                                            |
| --------------------- | ------------ | ------------------------------------------------------------------- |
| `manifest`            | `manifest`   | The manifest exists, parses, and declares a supported schema.       |
| `context structure`   | `structure`  | `.context/` exists, belongs to Syngraphe, and has the expected files. |
| `internal references` | `references` | Local paths referenced from context documents resolve.              |
| `AGENTS.md`           | `agents`     | The `AGENTS.md` managed block is present, unique and unmodified.    |
| `Claude integration`  | `agents`     | `CLAUDE.md` points at `AGENTS.md`, when Claude is used here.        |
| `context state`       | `state`      | `state/current.md` says something, and has not silently fallen behind. |

Checks do not cascade. When `.context/` is absent, the structure check reports it once and the
others stay quiet rather than adding six symptoms of the same cause.

Integrations that write nothing — Cursor, Codex — contribute no check: there is nothing about them
that can be wrong.

## Finding codes

Codes are stable. They are never renumbered, never reused for a different meaning, and never named
after internal implementation details.

### Structure — `CTX`

| Code     | Severity | Message                                             | Meaning                                                       |
| -------- | -------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `CTX001` | error    | Repository context is not initialized.              | No `.context/`. Run `syngraphe init`.                         |
| `CTX002` | error    | Expected context file is missing.                   | One of the seven schema files is absent. `init` restores it.  |
| `CTX003` | error    | `.context/` is not a Syngraphe repository context.  | The directory exists but belongs to something else.           |

### Manifest — `MANIFEST`

| Code          | Severity | Meaning                                                                   |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `MANIFEST001` | error    | `.context/manifest.json` is missing while the rest of the context exists.  |
| `MANIFEST002` | error    | The manifest is not valid JSON, is not an object, or has no numeric `schemaVersion`. The parser's message is included as details. |
| `MANIFEST003` | error    | The manifest declares a schema version this build does not support. Forces [exit code 3](/reference/exit-codes). |
| `MANIFEST004` | warning  | The manifest declares a layout this build does not know.                  |

### `AGENTS.md` — `AGENT`

| Code       | Severity | Meaning                                                        |
| ---------- | -------- | -------------------------------------------------------------- |
| `AGENT001` | error    | `AGENTS.md` has no Syngraphe block. Run `syngraphe init`.      |
| `AGENT002` | error    | The block was modified manually. Syngraphe will not overwrite it. |
| `AGENT003` | error    | The file contains more than one Syngraphe block.               |
| `AGENT004` | error    | The markers are unbalanced. The finding carries the line number. |
| `AGENT005` | error    | `AGENTS.md` cannot be managed safely — it is a directory, a symlink, or declares an unknown block version. |

These are errors rather than warnings because `.context/` without a bootstrap is context nothing
will read.

### Claude — `CLAUDE`

| Code        | Severity | Meaning                                                                    |
| ----------- | -------- | -------------------------------------------------------------------------- |
| `CLAUDE001` | warning  | Claude is used in this repository (a `CLAUDE.md` or `.claude/` exists) but nothing imports `AGENTS.md`. |
| `CLAUDE002` | error    | The `CLAUDE.md` managed block was modified manually.                        |
| `CLAUDE003` | error    | `CLAUDE.md` contains duplicate Syngraphe blocks.                            |
| `CLAUDE004` | error    | The markers in `CLAUDE.md` are unbalanced.                                  |
| `CLAUDE005` | warning  | A setup Syngraphe deliberately leaves alone, such as a symlink pointing elsewhere. |

A missing integration is a warning, not an error: an agent nobody uses here needs no file. Nothing at
all is reported for a repository that shows no sign of using Claude.

### References — `LINK`

| Code      | Severity | Meaning                                                               |
| --------- | -------- | --------------------------------------------------------------------- |
| `LINK001` | error    | A context document references a local path that does not exist. The finding carries the file and the line. |

Markdown links resolve relative to the document and are checked whatever they point at. Inline code
is prose, so only `.md` references are checked — `` `truth/architecture.md` `` — and they may
resolve relative to the document, from the repository root, or from `.context/`. A directory named
in inline code is not treated as a reference. Fenced code blocks, anchors and external URLs are
ignored. See [context schema](/reference/context-schema) for the reasoning.

### State — `STATE`

| Code       | Severity | Meaning                                                              |
| ---------- | -------- | -------------------------------------------------------------------- |
| `STATE001` | warning  | `state/current.md` has not changed in N days while the repository has. |
| `STATE002` | warning  | `state/current.md` contains only headings.                           |

## How freshness is judged

`STATE001` is raised only when **both** conditions hold:

1. the last commit touching `.context/state/current.md` is at least **45 days** old, and
2. the repository has commits newer than that one.

If Git cannot answer — no history, an untracked file, a shallow clone, no `git` on the `PATH` — the
check stays silent. An unanswerable question produces no finding.

The message states the age and asks for a review:

```text
WARN STATE001  .context/state/current.md
.context/state/current.md has not changed in 47 days.
This may be intentional. Review whether it still reflects the current repository state.
```

What it deliberately does not say is `ERROR: context is stale`. Age is a signal, not a verdict: a
document can be old and perfectly accurate, and a tool that cries wolf about it teaches people to
ignore the one time it matters.

## Severity and exit codes

| Severity  | Default run                | `--strict`            |
| --------- | -------------------------- | --------------------- |
| `error`   | fails (exit 1)             | fails (exit 1)        |
| `warning` | reported only (exit 0)     | fails (exit 1)        |
| `info`    | reported only              | reported only         |

`MANIFEST003` is the one special case: it forces [exit code 3](/reference/exit-codes) regardless,
because an unsupported schema makes every other answer unreliable.

## Adding a check

The registry is a list, and each check is a small object:

```ts
interface Check {
  id: string;
  label: string;         // the line printed in human output
  category: CheckCategory;
  run(context: CheckContext): Promise<Finding[]>;
}
```

`CheckContext` is a snapshot gathered once per run — the repository, the context inspection, the
`AGENTS.md` state, every agent's state, and the reference instant used by age-based checks. Checks
read from it; they never print, never write, and never decide the exit code.

Adding one means: a module in `src/checks/`, a line in the registry, a new stable code, tests, and a
row in this table.
