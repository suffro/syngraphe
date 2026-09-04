---
title: Architecture
description: How Syngraphe is put together — the dependency direction, the plan/apply core, and the two registries.
order: 2
---

# Architecture

Syngraphe is a Node.js/TypeScript CLI shipped as ESM. The deterministic core is offline: it touches
the filesystem and the system `git` executable, and nothing else. `commander` is the only runtime
dependency.

## Dependency direction

```text
cli → commands → core / inspectors → filesystem, Git
```

One way, no cycles.

- **`src/cli/`** — argument parsing, the output sink, and the mapping from errors to exit codes.
  Thin on purpose: no domain logic lives here.
- **`src/commands/`** — `init`, `status`, `check`. Each command is a composition root: it gathers
  inspections, consults the registries, renders, and applies.
- **`src/core/`** — `Repository` (path safety and repository-relative IO), `fs` (the only module
  that writes), `git` (a thin `execFile` wrapper), `plan` and `render-plan`, plus small text and
  Markdown helpers.
- **`src/managed/`** — the managed-block subsystem. `block.ts` is pure text manipulation;
  `file.ts` binds it to real files and produces plans.
- **`src/agents/`** — the `AgentIntegration` contract, the registry, one adapter per agent, and the
  `AGENTS.md` bootstrap that belongs to no single agent.
- **`src/checks/`** — the `Check` contract, the shared snapshot every check reads, one module per
  check, the registry and the runner.
- **`src/inspectors/`** — read-only classification of `.context/`.
- **`src/templates/`** — the generated file contents and the managed-block bodies.

Agent integrations and checks are **registries consumed by commands**, never conditionals scattered
through the core. That is what keeps "add an agent" and "add a check" to one module plus one line
plus tests.

## Inspect, plan, render, apply

Every command that can modify the repository goes through four separable stages:

```text
inspection  →  planning  →  display  →  apply
```

Inspection never writes. Planning never writes. Only `applyPlan` writes, and it applies a plan built
by someone else.

```ts
type FileOperation =
  | { type: "create"; path: string; contents: string; summary?: string }
  | { type: "patch"; path: string; before: string; after: string; summary: string };

interface Plan {
  operations: FileOperation[];
  unchanged: UnchangedEntry[];
  conflicts: PlanConflict[];
}
```

Three consequences fall out of this, none of which needed extra code:

- **`--dry-run` is honest.** It runs the same planner and returns before `applyPlan`. There is no
  second implementation that could disagree with the real one.
- **Conflicts stop everything.** A plan carrying conflicts is never partially applied — a
  half-applied plan is harder to reason about than one that did not run.
- **Stale plans fail loudly.** `patch` operations record the exact expected `before` content, and
  every precondition is verified before the first write. A file that changed underneath produces an
  error, not a clobber.

The same shape is what a future `update` or `reconcile` command would reuse; nothing in the plan
types is specific to initialization.

## Managed blocks as a generic subsystem

`src/managed/block.ts` knows about text and nothing else — not `AGENTS.md`, not Claude, not agents at
all. Every function is a pure string transformation:

```ts
findManagedBlock(content)
validateManagedBlock(content, expectedBody)
insertManagedBlock(content, body)
replaceManagedBlock(content, body)
removeManagedBlock(content)
```

Purity is what makes the guarantees testable exhaustively rather than sampled: that insertion is
exactly reversible, that CRLF survives, that a missing final newline survives, that a hand-edited
block is detected. See [managed blocks](/reference/managed-blocks).

`src/managed/file.ts` is the thin layer that reads a real file, classifies its block, and turns that
classification into a plan. Both `AGENTS.md` and `CLAUDE.md` go through it.

## The two registries

```ts
interface AgentIntegration {
  id: string;
  displayName: string;
  findingCodes?: AgentFindingCodes;
  detect(repository: Repository): Promise<AgentDetection>;
  inspect(repository: Repository): Promise<AgentIntegrationState>;
  planIntegration(repository: Repository): Promise<Plan>;
}

interface Check {
  id: string;
  label: string;
  category: CheckCategory;
  run(context: CheckContext): Promise<Finding[]>;
}
```

Integrations declare their own finding codes, so an agent's failure modes are described by its
adapter rather than by a switch statement somewhere in the check layer. An integration that cannot
fail — one that reads `AGENTS.md` natively — declares none and contributes no check.

## One snapshot per run

`check` and `status` build a single `CheckContext` — the repository, the context inspection, the
`AGENTS.md` state, every agent's state, and the reference instant for age-based checks — and every
check reads from it.

Two reasons. A run is internally consistent: no check can observe a repository that changed halfway
through. And `status` reuses the same checks `check` runs, so the two commands can never disagree
about how many findings are open.

Injecting `now` rather than calling `Date.now()` inside a check is what makes the freshness tests
deterministic instead of dependent on when they run.

## Filesystem discipline

All writing goes through one module. Commands never call `node:fs`.

- Writes are complete-file writes into a temporary file in the destination directory, followed by a
  rename — so an interrupted run cannot leave a half-written file, and the rename stays on one
  filesystem and is therefore atomic.
- `Repository.resolve` rejects absolute paths and anything that escapes the Git root.
- Before writing, every path segment from the root down is checked: a symlink anywhere along the way
  is refused rather than followed.
- Directory walks use `lstat` and do not follow symlinks.

## Git usage

Deliberately minimal. Two operations, both through `execFile` with an argument array — never a shell
string, so a repository path can never be interpreted as a command:

- `git rev-parse --show-toplevel` — locate the repository root.
- `git log -1 --format=%cI -- <path>` — the last commit date of a path, for freshness.

A missing executable, a non-repository directory, and a failed command are all the same answer: *no
information available*. Checks that depend on Git then stay silent rather than guessing.

There is no `simple-git` and no libgit binding: two commands do not justify a dependency, and
`execFile` with an argument array is the safer call anyway.

## Testing

`node:test` and `node:assert`, no framework.

Integration tests create real temporary Git repositories in the system temporary directory, run the
CLI in process against them, and remove them afterwards. They cover the cases that matter for a tool
that edits user files: an existing `AGENTS.md` with and without a heading, an existing `CLAUDE.md`, a
symlinked one, CRLF files, files without a final newline, duplicate blocks, hand-edited blocks, an
unrelated `.context/`, an unsupported schema.

Two properties are asserted directly because they are product invariants rather than implementation
details: **idempotency** (init, snapshot, init again, snapshots equal) and **preservation** (init,
remove the managed block, the file equals the original byte for byte).

## Designed to extend, not extended yet

Several things are deliberately absent but not designed out: `doctor`, `update`, `reconcile`, schema
migrations, and an eventual `AgentRunner` for semantic analysis by an installed agent. Each of them
fits the existing seams — plans, registries, the schema version in the manifest — which is why they
are named here and implemented nowhere. See [scope and non-goals](/concepts/scope-and-non-goals).
