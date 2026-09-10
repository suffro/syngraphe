---
title: GitHub Action
description: Official Syngraphe Action with checks, statistics, monorepo scopes, annotations and JSON reports.
order: 7
---

# Syngraphe GitHub Action

Validate repository context, surface findings on files and lines, and measure context size in one
step. The Action bundles the same checks and statistics code as the CLI. It needs a checked-out Git
repository, not a Node setup step, package install or API token. It never runs code from the target
repository or modifies its context.

Action releases have their own version series: `action-v1.0.0` identifies the first release;
`action-v1` tracks compatible updates. These tags are independent of the npm CLI version.
For reproducibility, replace the tag in examples with the reviewed full commit SHA from the
[release](https://github.com/suffro/syngraphe/releases/tag/action-v1.0.0).
Use `uses: ./` to test a checked-out copy of the Action in its own repository.

## Basic use

Example workflow in a repository that consumes the Action:

```yaml
name: Repository context
on: [push, pull_request]
permissions:
  contents: read
jobs:
  context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: suffro/syngraphe@action-v1
        with:
          strict: 'true'
```

The declared `node24` runtime is supplied by the Actions runner. Linux, macOS and Windows runners
are supported by the implementation and CI matrix. Self-hosted runners must support Node 24 Actions
(at least runner 2.327.1) and have Git available. Fetch full history for meaningful freshness checks;
the Action does not fetch, repair shallow history or alter Git configuration for you.

## Inputs

All inputs are optional. Boolean values accept `true`/`false` (case-insensitive). Invalid values,
unsafe paths and incompatible mode combinations fail the step even in report-only mode.

| Input | Default | Behavior |
| --- | --- | --- |
| `command` | `check` | `check`, `stats`, or `check-and-stats`. |
| `working-directory` | `.` | Checkout location relative to `GITHUB_WORKSPACE`. Its Git root is selected, even if this names a subdirectory. The Git root must remain inside the workspace. |
| `scope` | empty | One existing scope relative to that Git root; defaults to the root. |
| `all` | `false` | Discover all tracked/unignored contexts. Mutually exclusive with `scope`. |
| `strict` | `false` | Check warnings become validation failures. Requires a check mode. |
| `budget` | `8000` | Positive integer estimated Markdown token budget, separately for each scope, including history. |
| `fail-on-error` | `true` | Fail on integrity/strict/unsupported-schema results. `false` keeps reporting those results without failing the step. Operational errors still fail. |
| `fail-on-budget` | `false` | Independently fail when any measured scope exceeds budget. Requires a stats mode. |
| `annotations` | `true` | Emit file/line annotations for check findings and warnings for exceeded budgets. |
| `summary` | `true` | Append a bounded GitHub job summary with scope totals and findings. |
| `max-annotations` | `50` | Cap finding annotations at 0–1000, errors first. Full findings remain in JSON; GitHub may impose additional display limits. |

The Action is read-only: it exposes no `init`, document mutation, arbitrary CLI argument or shell
input. To select several specific packages, use a workflow matrix with `scope`; use `all` to
inspect every discoverable context. Empty or ignored nested contexts require explicit selection.

## Outputs and artifacts

| Output | Meaning |
| --- | --- |
| `ok` | Validation passed under the configured strict/budget policy. Independent of `fail-on-error`. |
| `exit-code` | Syngraphe validation code: `0` success, `1` integrity/strict/budget failure, `2` invalid usage/unsafe path, `3` unsupported schema, `4` internal failure. |
| `errors`, `warnings` | Check finding counts; stats budget warnings are not included. |
| `failure-count` | Scope operations that could not produce a check/stats result. |
| `scope-count` | Number of reported contexts. |
| `bytes`, `estimated-tokens` | Sum across scopes with successful stats results; zero in check-only mode. |
| `budget-exceeded` | Any measured scope exceeded its budget, even when the budget gate is off. |
| `report-path` | Absolute path to a fresh JSON report under `RUNNER_TEMP`. |

Outputs are strings in GitHub expressions. Compare `ok` to `'true'` rather than testing the string's
truthiness. On validation failure the report, outputs and summary are written **before** the step
fails. Startup failures (invalid input, missing checkout, failed discovery) may have no report; then
only `ok` and `exit-code` are guaranteed. Publishing failures also fail the step.

`exit-code` is the validation result; the Action process exits `0` or `1` according to the step
policy. With `fail-on-error: 'false'`, `ok: 'false'` and a successful step are intentional. Invalid
usage and internal errors always fail. Unsupported schemas take precedence over integrity errors;
operational errors take precedence over both. `fail-on-budget` is independent of report-only mode.

The report has its own `version: 1` schema: `command`, `ok`, `exitCode`, `shouldFail`, `errors`,
`warnings`, `failureCount`, `estimatedTokens`, `bytes`, `budgetExceeded` and `scopes`. Each scope
contains `scope`, `workspacePath`, optional `check` (`ok`, `exitCode`, `findings`), optional `stats`
(the CLI stats payload), and `failures` (`phase`, `exitCode`, `message`). Partial stats totals include
only successful scopes; inspect failures before treating them as complete. Scope paths are relative
to the selected Git root; `workspacePath` also accounts for a checkout nested in `GITHUB_WORKSPACE`.
Finding paths and stats document paths inside reports remain scope-relative. Annotations are
prefixed with `workspacePath` so GitHub locates the correct file.

The Action makes no GitHub API calls. To retain reports after a job, upload them explicitly:

```yaml
- uses: suffro/syngraphe@action-v1
  id: context
  with:
    command: check-and-stats
    all: 'true'
    budget: '12000'
    fail-on-budget: 'true'
- uses: actions/upload-artifact@v7
  if: always() && steps.context.outputs.report-path != ''
  with:
    name: repository-context
    path: ${{ steps.context.outputs.report-path }}
    if-no-files-found: error
```

Reports contain repository paths and finding text, but no document bodies. Normal GitHub artifact
visibility and retention settings apply. Report files use unique directories so multiple invocations
do not overwrite one another or create untracked files in the checkout.

## Common configurations

A gradual rollout that reports all problems without failing on validation findings:

```yaml
- uses: suffro/syngraphe@action-v1
  with:
    command: check-and-stats
    all: 'true'
    strict: 'true'
    fail-on-error: 'false'
```

A secondary checkout, or a single package:

```yaml
- uses: suffro/syngraphe@action-v1
  with:
    working-directory: application
    scope: packages/api
    strict: 'true'
```

Statistics only, with an enforced budget and no annotations:

```yaml
- uses: suffro/syngraphe@action-v1
  with:
    command: stats
    budget: '10000'
    fail-on-budget: 'true'
    annotations: 'false'
```

Budgets use the CLI heuristic: ceil(UTF-8 bytes / 4) per Markdown file, summed per scope. They are
not a tokenizer or the size of the prompt an agent actually loads. The report includes active and
history totals, large documents and duplicate groups. No content is removed automatically.

## Development and release

Canonical Action sources live in `action/src/`; core checks and inspectors stay in `src/`.
The root `action.yml` is the public entry point. GitHub executes the committed
`action/dist/index.cjs` directly, with no runtime dependency install. `@actions/core`, `esbuild`
and `yaml` are development dependencies and do not enter the CLI's production dependency graph.

```bash
npm ci --ignore-scripts
npm run action:build
npm run action:check
npm run test:action
npm run typecheck
npm run lint
```

`action:build` regenerates the bundle and third-party notices. `action:check` rebuilds in memory and
fails on any byte difference, without rewriting files. Run it whenever shared core code changes.
Commit generated files with their canonical sources; do not edit the bundle manually.
The CI workflow runs the local Action before installing dependencies, then validates the bundle and
tests on Ubuntu, macOS and Windows. Bundle files use LF on every platform for reproducibility.

Every Action release must include the metadata and regenerated bundle at a commit whose CI passes.
Create an immutable annotated `action-vMAJOR.MINOR.PATCH` tag, then update the corresponding
`action-vMAJOR` compatibility tag only after validation. Publish its GitHub release and select
Marketplace publication in the release editor. Verify the release and public listing separately;
a GitHub release alone does not prove Marketplace publication. Never retarget an exact version tag.
The npm CLI keeps its own version and publication process.

GitHub references: [JavaScript actions](https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action),
[metadata and Node 24](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax),
[runner requirement](https://github.com/actions/checkout#whats-new).
