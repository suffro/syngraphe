# Architecture

## Overview

Syngraphe is a Node.js/TypeScript CLI (ESM) that creates and validates the `.context/` repository
context and the agent bootstrap files that point at it. The deterministic core is offline: it uses
the filesystem and the system `git` executable, nothing else.

The dependency direction is one-way:

```text
cli → commands → core / inspectors → filesystem, Git
```

Agent integrations and checks are registries consumed by commands, never hardcoded in the core.

## Major components

- `src/cli/` — argument parsing (Commander), the `Output` sink, error-to-exit-code mapping.
- `src/commands/` — `init`, `status`, `check`. Composition roots: they gather inspections, consult
  the registries, render, and apply.
- `src/core/` — `Repository` (path safety, repository-relative IO), `fs` (the only module that
  writes), `git` (thin `execFile` wrapper), `plan` + `render-plan` (plan/apply), `text`, `markdown`,
  `errors`, `exit-codes`.
- `src/managed/` — the generic managed-block subsystem: `block.ts` is pure text, `file.ts` binds it
  to real files and produces plans.
- `src/agents/` — the `AgentIntegration` contract, the registry, one adapter per agent, plus
  `agents-md.ts` for the canonical bootstrap file that belongs to no single agent.
- `src/checks/` — the check contract, the shared `CheckContext`, one module per check, the registry
  and the runner.
- `src/inspectors/` — read-only classification of `.context/`.
- `src/templates/` — the generated file contents and the managed-block bodies. These strings are a
  contract: checks compare against them.
- `docs/` — the VitePress documentation site (syngraphe.dev), with its own `package.json`. Content is
  Markdown under `docs/getting-started/`, `docs/guides/`, `docs/reference/` and `docs/concepts/`; the
  branded theme lives in `docs/.vitepress/theme/`, which also registers the components pages may use
  in Markdown: `Tabs`/`Tab` and `ExampleNote`.
- The site also publishes a machine-readable surface: `docs/.vitepress/llms.mjs` generates
  `llms.txt`, `llms-full.txt` and one Markdown twin per page at build time, and
  `docs/functions/_middleware.js` serves those twins to `Accept: text/markdown`. Three places derive
  a twin's path from a route — the generator, the middleware and the head link in
  `docs/.vitepress/config.mts` — and `test/docs-markdown.test.ts` is what holds them to the same
  answer. Every component usable in a page also has to be flattened by `toPlainMarkdown` in
  `llms.mjs`, or its tags reach the Markdown surface verbatim.

## Data flow

`init` inspects, plans, renders, applies — always in that order. `--dry-run` runs the same planner
and stops before `applyPlan`. `check` and `status` build one `CheckContext` snapshot and read from
it, so a single run is internally consistent.

## External systems

The system `git` executable, invoked with `execFile` (never a shell). Git is optional at runtime for
everything except locating the repository root: when a Git answer is unavailable, age-based checks
stay silent rather than guessing.

## Important constraints

- Syngraphe owns only the text between its markers; everything else is user-owned and preserved byte
  for byte, including line endings and a missing final newline.
- Initialization is idempotent, and drift is reported rather than overwritten.
- No writes outside the Git root, and never through a symlink.
- Writes are complete-file writes (temporary file + rename).
- Finding codes, exit codes, the `--json` shape and the context schema are stable contracts.
- The repository must stay fully usable if Syngraphe disappears: Syngraphe implements the
  repository-context protocol, the protocol does not depend on Syngraphe.
