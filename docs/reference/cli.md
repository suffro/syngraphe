---
title: CLI commands
description: Every Syngraphe command and flag, with its output and exit codes.
order: 1
---

# CLI commands

```text
syngraphe [options] [command]
```

Or you can also use the shorthand `syg`:

```text
syg [options] [command]
```

| Option          | Effect                     |
| --------------- | -------------------------- |
| `-v, --version` | Print the version and exit |
| `-h, --help`    | Print help and exit        |

The CLI is installed under two interchangeable names: `syngraphe` and the shorthand `syg`. This
reference uses the full name.

Every command must run inside a Git working tree; paths are resolved against the repository root
regardless of the working directory. Nothing here reaches the network.

## `syngraphe init`

Creates the repository context and the agent bootstrap files.

```bash
syngraphe init [--dry-run]
```

| Option      | Effect                                          |
| ----------- | ----------------------------------------------- |
| `--dry-run` | Render the plan and exit without writing a file. |

### What it does

1. Inspects `.context/`, `AGENTS.md`, and every registered agent integration.
2. Builds a single plan: files to create, files to patch, things left unchanged, conflicts found.
3. Renders the plan.
4. Applies exactly that plan — unless `--dry-run` was passed, or the plan reported conflicts.

`--dry-run` is not a simulation: it runs the same planner and stops before the apply step.

### Output

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

| Section      | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `CREATE`     | Files that do not exist and will be created.                             |
| `PATCH`      | Existing files that gain a managed block. Nothing else in them changes.  |
| `UNCHANGED`  | What was found and deliberately left alone, with the reason.             |
| `CONFLICTS`  | What blocks the run. When present, nothing at all is written.            |

A real run ends with `N files written.` instead of `No files were modified.`; a run with nothing to
do ends with `Nothing to do. The repository context is already initialized.`

### Behaviour worth knowing

- **Idempotent.** A second run on an initialized repository writes nothing.
- **Additive.** Only the text between Syngraphe's markers is ever written into an existing file.
- **All-or-nothing.** If the plan contains conflicts, no operation is applied.
- **Precondition-checked.** Every operation is verified against the current state before the first
  write, so a stale plan fails instead of half-applying.

### Exit codes

| Code | When                                                                 |
| ---- | -------------------------------------------------------------------- |
| `0`  | The plan was applied, or `--dry-run` completed, or there was nothing to do. |
| `1`  | Conflicts were reported, or `.context/` is unrelated or has an invalid manifest. |
| `2`  | Not inside a Git repository, or invalid usage.                       |
| `3`  | `.context/manifest.json` declares an unsupported schema version.     |

## `syngraphe status`

Summarizes the repository context. Read-only, offline, fast.

```bash
syngraphe status
```

```text
Syngraphe

Context
  schema          v1
  layout          standard

Knowledge
  architecture    present
  conventions     present
  current state   present
  decisions       3
  history         2

Agents
  AGENTS.md       ready
  Claude          ready
  Cursor          native
  Codex           native

Integrity
  0 errors
  1 warning
```

| Section     | Contents                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------- |
| `Context`   | Declared schema version and layout — or `status not initialized` when there is no context. |
| `Knowledge` | Whether each core document exists; the number of `.md` files in `decisions/` and `history/` (excluding `README.md`). |
| `Agents`    | The state of `AGENTS.md` and of every registered integration. See [agent integrations](/guides/agent-integrations). |
| `Integrity` | Error and warning counts from the same checks `syngraphe check` runs.                     |

`status` always exits `0`: it reports, it does not judge. Use `check` for a pass/fail answer.

## `syngraphe check`

Runs the deterministic check registry.

```bash
syngraphe check [--json] [--strict]
```

| Option     | Effect                                                     |
| ---------- | ---------------------------------------------------------- |
| `--json`   | Emit the findings as a versioned JSON payload.             |
| `--strict` | Warnings fail the command as well as errors.               |

### Human output

```text
Syngraphe context integrity

✓ manifest
✓ context structure
✓ internal references
✓ AGENTS.md
✓ Claude integration
! context state

WARN STATE002  .context/state/current.md
Current state contains only headings.
Describe the current focus so the file is useful to humans and agents.

1 warning
```

One line per check, then the findings, then a summary.

| Symbol | Meaning                              |
| ------ | ------------------------------------ |
| `✓`    | The check found nothing.             |
| `!`    | The check produced warnings only.    |
| `✗`    | The check produced at least one error. |

Each finding is printed as `SEVERITY CODE  file:line`, the message, and any details. Every code is
documented in [checks and findings](/reference/checks).

### JSON output

See [JSON output](/reference/json-output) for the payload shape and its stability guarantees.

### Exit codes

| Code | When                                                                   |
| ---- | ---------------------------------------------------------------------- |
| `0`  | No errors — and no warnings under `--strict`.                          |
| `1`  | At least one error, or a warning under `--strict`.                     |
| `2`  | Not inside a Git repository, or invalid usage.                         |
| `3`  | A `MANIFEST003` finding: the context schema is unsupported.            |

Exit code 3 takes precedence over 1: an unsupported schema means the answer to every other question
is unreliable, and the fix is to upgrade the tool rather than change the repository.

## Programmatic use

The same core is exported from the package, so a script can run the checks without parsing terminal
output:

```ts
import { Repository, createCheckContext, runChecks } from "syngraphe";

const repository = await Repository.open(process.cwd());
const { findings, errors, warnings } = await runChecks(await createCheckContext(repository));
```

`planInitialization(repository)` returns the same plan `init` renders, if you want to inspect it
before deciding anything.
