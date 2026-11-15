---
title: Programmatic API
description: Every export of the syngraphe package, grouped by purpose, with what each one does.
order: 8
---

# Programmatic API

Syngraphe is a command-line tool first. The package also exports the deterministic core the CLI is
built from, so a Node script can run the same checks, build the same plans and read the same
statistics without parsing terminal output.

<ExampleNote>A minimal script, not something Syngraphe ships.</ExampleNote>

```ts
import { Repository, createCheckContext, runChecks } from "syngraphe";

const repository = await Repository.open(process.cwd());
const { findings, errors, warnings } = await runChecks(await createCheckContext(repository));
```

The package is ESM-only, requires the same Node.js version as the CLI, and ships TypeScript
declarations. **This page lists every export, and nothing else is exported.** A test holds this page
and the package entry point to the same list of names. Every name here is covered by the
[compatibility policy](/reference/compatibility).

Mutating functions follow the same order as the CLI: inspect, build a plan, then apply exactly that
plan. Nothing that builds a plan writes anything.

## Repository access

| Export | Kind | Purpose |
| --- | --- | --- |
| `Repository` | class | A Git repository, or a scope inside one, with path-safe repository-relative access. |
| `ReadOnlyRepository` | interface | The reading half of `Repository`. Every inspector and planner accepts it. |
| `discoverScopes` | function | `discoverScopes(repository)` returns one `Repository` per tracked or unignored context, the list `--all` uses. |
| `SyngrapheError` | class | The error every command throws for an expected failure. It carries an `exitCode` and optional `details`. |

`Repository` members:

- `Repository.open(cwd)` locates the Git root containing `cwd`. It selects the root, never the
  working directory.
- `Repository.atRoot(root)` uses `root` as it is, without asking Git.
- `repository.inScope(scope)` selects an existing directory, given relative to the Git root.
- `root`, `gitRoot` and `scope` are the selected directory, the containing Git root, and the
  selection as a Git-relative POSIX path (`.` at the root).
- `kind`, `size`, `read`, `readBytes`, `realPath`, `list`, `resolve`, `relativize` and
  `assertWritablePath` are the reads `ReadOnlyRepository` defines. `git` is a read-only Git client.
- `create`, `replace`, `write` and `makeDirectory` are the writes. All of them refuse symlinked
  targets and parents, and the file writes stage a complete file before publishing it:
  - `create` returns `false` when the destination already exists;
  - `replace` publishes only if the file still holds exactly the expected content;
  - `write` replaces without comparing, so plans never use it.

  See the [safety model](/concepts/safety-model).

## Checks

| Export | Kind | Purpose |
| --- | --- | --- |
| `createCheckContext` | function | `createCheckContext(repository, { now? })` takes the one snapshot every check reads from. |
| `runChecks` | function | `runChecks(context, registry?)` runs the checks and returns `{ results, findings, errors, warnings }`. |
| `checks` | const | The check registry, in the order `check` runs it. |
| `inspectContext` | function | `inspectContext(repository)` classifies `.context/` as `absent`, `valid`, `partial`, `unsupported-schema`, `invalid-manifest` or `unrelated`, and reads its manifest. |
| `Check` | interface | One check: `id`, `label`, `category` and `run(context)`. |
| `CheckContext` | interface | The snapshot passed to every check. |
| `Finding` | interface | One finding, with the same fields as [check JSON](/reference/json-output#check-json). |
| `Severity` | type | `"error"` or `"warning"`. |
| `CHECK_JSON_VERSION` | const | The version of the `check --json` payload. |
| `runCheck` | function | The `check` command itself: `runCheck({ repository, output, json, strict, now? })`, which writes the report and returns an exit code. |
| `runStatus` | function | The `status` command: `runStatus({ repository, output, now? })`. |

## Plans and initialization

| Export | Kind | Purpose |
| --- | --- | --- |
| `planInitialization` | function | `planInitialization(repository, { policy? })` returns the plan `init` would apply. |
| `planDocument` | function | `planDocument(repository, category, name, { title?, archive? })` returns the plan a `<category> new` command, or `state archive` with `archive: true`, would apply. |
| `listDocuments` | function | `listDocuments(repository, category)` returns the sorted document paths `<category> list` prints. |
| `DocumentCategory` | type | `"truth"`, `"decision"`, `"state"` or `"history"`. |
| `Plan` | interface | `{ operations, unchanged, conflicts }`. |
| `FileOperation` | type | A `create` with `contents`, or a `patch` with the exact `before` and `after` text. |
| `emptyPlan` | function | A plan with nothing in it. |
| `applyPlan` | function | `applyPlan(repository, plan)` applies exactly the plan given. It refuses a plan with conflicts and fails if any file changed since the plan was built. |
| `renderPlan` | function | `renderPlan(plan, title)` is the human rendering the CLI prints. |
| `planToJson` | function | `planToJson(plan, scope)` is the content-free [plan JSON](/reference/json-output) projection. |
| `PLAN_JSON_VERSION` | const | The version of the plan JSON payload. |
| `PlanJsonReport` | interface | The plan JSON payload. |
| `PlanJsonOperation` | type | One operation in plan JSON: its `type`, `path` and summary, never its contents. |
| `PlanJsonUnchangedEntry` | interface | One unchanged path, with its reason. |
| `PlanJsonConflict` | interface | One conflict, with its message. |
| `runInit` | function | The `init` command: `runInit({ repository, output, dryRun, json?, policy? })`. |
| `runDocument` | function | The document commands: `runDocument({ repository, output, category, name, title?, archive?, dryRun, json? })`. |

## Statistics

| Export | Kind | Purpose |
| --- | --- | --- |
| `inspectStats` | function | `inspectStats(repository, budget?)` returns the same object as `stats --json`. |
| `ContextStats` | interface | The statistics payload. |
| `SizeTotals` | interface | File, byte, word and token totals. |
| `DocumentSize` | interface | The size of one Markdown document. |
| `DEFAULT_TOKEN_BUDGET` | const | The advisory budget used when none is given. |
| `LARGE_DOCUMENT_TOKENS` | const | The estimated-token size above which a document is reported as large. |
| `runStats` | function | The `stats` command: `runStats({ repository, output, json, budget? })`. |

## Managed blocks

The pure text functions behind [managed blocks](/reference/managed-blocks), plus their binding to
real files.

| Export | Kind | Purpose |
| --- | --- | --- |
| `findManagedBlock` | function | Locates the block in a string: absent, found, duplicate or malformed. |
| `validateManagedBlock` | function | `validateManagedBlock(content, expectedBody, supersededBodies?)` classifies the block against the body Syngraphe would write. |
| `insertManagedBlock` | function | Inserts a block, following the placement and padding rules. |
| `replaceManagedBlock` | function | Replaces the body of the existing block. |
| `removeManagedBlock` | function | Removes the block. It is the exact inverse of insertion. |
| `renderManagedBlock` | function | Renders a block, with its markers, around a body. |
| `MANAGED_BLOCK_VERSION` | const | The marker format version, `"1"`. |
| `inspectManagedFile` | function | `inspectManagedFile(repository, path, expectedBody, supersededBodies?, isNewer?)` reads a file and classifies its block. |
| `planManagedFile` | function | `planManagedFile(state, expectedBody, summary)` turns that classification into a plan. |

## Agent integrations

| Export | Kind | Purpose |
| --- | --- | --- |
| `agentIntegrations` | const | The registry of agent integrations: Claude, Cursor and Codex. |
| `AgentIntegration` | interface | One integration: detection, inspection and planning for one agent. |
| `AgentIntegrationState` | interface | What an integration found: its status, the files involved and an explanation. |

## Context schema

The [schema v1](/reference/context-schema) constants. Paths are relative to the selected scope.

| Export | Kind | Purpose |
| --- | --- | --- |
| `CONTEXT_PROTOCOL` | const | `"repository-context"`, the protocol a manifest declares. |
| `CONTEXT_SCHEMA_VERSION` | const | The schema version this build writes and supports. |
| `CONTEXT_LAYOUT` | const | `"standard"`. |
| `CONTEXT_DIRECTORY` | const | `".context"`. |
| `CONTEXT_ENTRIES` | const | The top-level entries of the standard layout. |
| `CONTEXT_TEMPLATES` | const | The files `init` creates, with their contents. |
| `ContextTemplate` | interface | One template: a path and its contents. |
| `REQUIRED_CONTEXT_FILES` | const | The files whose absence is `CTX002`. |
| `MANIFEST_FILE` | const | `"manifest.json"`. |
| `MANIFEST_PATH` | const | `.context/manifest.json`. |
| `INDEX_PATH` | const | `.context/index.md`. |
| `ARCHITECTURE_PATH` | const | `.context/truth/architecture.md`. |
| `CONVENTIONS_PATH` | const | `.context/truth/conventions.md`. |
| `CURRENT_STATE_PATH` | const | `.context/state/current.md`. |
| `DECISIONS_DIRECTORY` | const | `.context/decisions`. |
| `DECISIONS_README_PATH` | const | `.context/decisions/README.md`. |
| `HISTORY_DIRECTORY` | const | `.context/history`. |
| `HISTORY_README_PATH` | const | `.context/history/README.md`. |

## Exit codes and the CLI

| Export | Kind | Purpose |
| --- | --- | --- |
| `EXIT_SUCCESS` | const | `0`. |
| `EXIT_INTEGRITY_FAILURE` | const | `1`. |
| `EXIT_USAGE` | const | `2`. |
| `EXIT_UNSUPPORTED_SCHEMA` | const | `3`. |
| `EXIT_INTERNAL` | const | `4`. |
| `ExitCode` | type | The union of the five [exit codes](/reference/exit-codes). |
| `main` | function | `main(argv, { output?, cwd? })` runs the CLI in-process and returns its exit code. |
| `Output` | interface | Where commands write: standard output and standard error. |
