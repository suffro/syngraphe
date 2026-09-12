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
| `--scope <path>` | Select an existing directory relative to the Git root |

The CLI is installed under two interchangeable names: `syngraphe` and the shorthand `syg`. This
reference uses the full name.

Every command must run inside a Git working tree. Without `--scope`, paths resolve against the
Git root regardless of the working directory. With `--scope`, context and agent files resolve
inside that directory. The scope argument itself is always Git-root-relative, using forward slashes.
The option can appear before or after the command. Nothing here reaches the network.

`status`, `check`, and `stats` also accept `--all`; it cannot be combined with `--scope`.

::: info Nested contexts and monorepos
Use `--scope <path>` to manage context for a specific package or directory within your repository.
See [Nested contexts and monorepos](/guides/monorepos) for examples and details.
:::

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

## `syngraphe stats`

Measures context size and reports advisory bloat signals. Requires an initialized, supported context.

```bash
syngraphe stats [--json] [--budget <tokens>] [--scope <path> | --all]
```

- Bytes and file counts include every regular file under the selected `.context/` recursively.
- Words are whitespace-separated runs in `.md` files. Estimated tokens are
  `ceil(UTF-8 bytes / 4)` **per Markdown file**, summed for totals. This is a rough sizing heuristic,
  not a model tokenizer or the actual context loaded by an agent.
- Active means everything outside `history/`; it includes decisions, optional documents and metadata.
  History is reported separately, and total is their sum. Agent bootstrap files are not counted.
- The default total Markdown budget is **8,000 estimated tokens**. `--budget` accepts a positive
  safe integer. Exceeding it is advisory and still exits `0`.
- The human report lists the ten largest Markdown files, all documents above **2,000 estimated
  tokens**, and groups of nonempty Markdown files with identical contents. JSON includes every
  document, sorted by descending bytes and then path.
- Symlinks and other non-regular entries encountered during traversal are skipped and reported.
  Required context paths reached through symlinks are refused before inspection.

Exit codes: `0` for a report, `1` for an absent, incomplete or unusable context, `2` for invalid
arguments or unsafe paths, `3` for an unsupported schema. No content is rewritten or deleted.
See [JSON output](/reference/json-output) for the versioned report.

## Document commands

```bash
syngraphe decision new <name> [--title <title>] [--dry-run]
syngraphe state new <name> [--title <title>] [--dry-run]
syngraphe history new <name> [--title <title>] [--dry-run]

syngraphe decision list
syngraphe state list
syngraphe history list

syngraphe state archive <name> [--dry-run]
```

All commands accept `--scope <path>` and require an initialized, supported context.

`new` creates a file in `decisions/`, `state/` or `history/`. The name is a filename, with an optional
`.md` suffix: letters, numbers, hyphens and underscores, starting with a letter or number, at most
120 characters before the suffix. Paths, `README`, and Windows device names are refused.
Existing names, including case-only collisions, are conflicts; there is no overwrite option.

The default heading uses the filename with hyphens and underscores replaced by spaces. `--title`
sets a nonempty single-line heading. The generated body contains only headings:

| Category | Headings |
| --- | --- |
| `decision` | Context; Decision; Alternatives considered; Consequences |
| `state` | Current focus; Recent relevant changes; Next; Blockers |
| `history` | Summary; Outcome; Follow-up |

No decision number, date or status is invented. The files stay ordinary Markdown. The index is
left for the author to curate; new files do not automatically join its always-relevant reading list.

`list` prints top-level regular `.md` files in filename order, excluding `README.md` and symlinks.
`state list` includes `current.md`. An empty list prints `No documents found.`

`state archive` copies the full UTF-8 content of `state/current.md` to `history/<name>.md`, preserving
line endings and a missing final newline, then resets current state to its original empty template.
The archive keeps the original title. Refill current state afterwards; until then `check` reports
`STATE002`. Review any document-relative links in the archived content.

Every write uses the same plan/apply flow as `init`. A destination conflict, unsafe write path or
stale source aborts before the first write. A new document is created exclusively: if another
process takes the name first, the command fails with exit code `1` instead of overwriting it. Each
write is atomic, but the two-file archive is not a filesystem transaction: an IO failure after
creation may leave the archive and original state both present, preserving the source. `--dry-run`
renders this same plan without applying it.

Exit codes: `0` for success or dry-run, `1` for a conflict or unusable context, `2` for invalid names,
titles, scopes or unsafe paths, `3` for an unsupported schema.

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

`(await Repository.open(cwd)).inScope("packages/api")` selects a package. The returned `root` is the
scope's absolute directory, `gitRoot` is the containing Git root, and `scope` is its Git-relative
POSIX path (`.` at the root). `Repository.open` and `Repository.atRoot` retain their default behavior.
`discoverScopes(repository)` returns the same scope list used by `--all`.

`inspectStats(repository, budget?)` returns structured statistics. `planDocument(repository,
"decision", "use_postgres", { title: "Use PostgreSQL" })` returns a creation plan;
`planDocument(repository, "history", "phase_one", { archive: true })` returns an archival plan.
`listDocuments(repository, "state")` returns the sorted paths without terminal formatting.
