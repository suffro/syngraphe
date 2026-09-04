---
title: Scope and non-goals
description: What v0.1 does, what Syngraphe will never do, and what is postponed rather than refused.
order: 5
---

# Scope and non-goals

## What v0.1 does

- `syngraphe init`, with `--dry-run`
- `syngraphe status`
- `syngraphe check`, with `--json` and `--strict`
- the `.context/` schema v1 and its templates
- managed blocks in `AGENTS.md` and `CLAUDE.md`
- the agent-integration registry: Claude (shim), Cursor and Codex (native)
- the deterministic check registry, with stable finding and exit codes

That is the whole surface. It is small because the small version is the one you can adopt this
afternoon and audit in a single `git diff`.

## Never

These are not "not yet". They are outside what Syngraphe is.

**Vendor rule synchronization.** Syngraphe will not translate or synchronize hooks, permissions, MCP
configuration, subagents, skills, editor capabilities or vendor-specific commands. Those are vendor
features and they stay vendor-specific. Tools that do this exist; being one of them would mean
tracking every vendor's configuration format forever, and would make Syngraphe the thing that breaks
when a vendor changes theirs.

**Owning your context.** The files are yours. Syngraphe writes templates once, checks structure, and
otherwise does not read your prose for meaning, normalise it, or rewrite it.

**A required service.** No account, no hosted index, no phoning home. If a future version gains
optional AI assistance, the deterministic core still works offline without it.

**Silent repair.** Nothing that looks wrong is fixed behind your back. Drift, duplicates and
malformed markers are reported.

**Hooks on install.** Installing a package should install a binary, not modify your repository or
your Git configuration.

## Postponed

Named because they shape the current design, implemented nowhere.

**`syngraphe doctor`.** A deeper diagnosis, possibly per agent (`--agent claude`). Needs the check
framework to grow a notion of remediation first.

**`syngraphe update`.** Bringing managed blocks and templates up to a newer version of the format,
including a schema migration path. The plan/apply core and the schema version in the manifest exist
so that this can be added without redesign.

**`syngraphe reconcile`.** Reconciling context that drifted from the repository it describes. This
is the one that genuinely wants semantic analysis, which is why it is last.

**Semantic analysis through an installed agent.** A future `AgentRunner` would ask an agent you
already have — not a provider API — to judge whether the context still matches the code. Kept
strictly separate from `AgentIntegration`, which is only about how an agent *discovers* context.
There will be no `--provider` flag: direct OpenAI, Anthropic or Gemini integrations are not planned.

**Destructive removal.** A command that removes the repository context. It must show exactly what
would be removed, preserve everything outside managed blocks, treat `.context/` as potentially
irreplaceable human writing, and require an explicit confirmation phrase. It will not be called
`uninstall`: it removes your writing, not a program.

**Per-check suppression.** Some repositories will want to silence one check. Doing it well means
deciding where the configuration lives and how a suppression expires; doing it badly means a config
file that quietly disables everything. Not in v0.1.

## Not planned

**MCP server, vector database, embeddings.** The context is a handful of Markdown files. Retrieval
infrastructure for something that fits in a directory listing is machinery without a problem.

**A GitHub Action.** `npx syngraphe check` is one line in any workflow. A wrapper would add a release
surface and no capability.

**A web dashboard.** The repository is the interface. `git log .context/` is the history view.

**Multi-repository or organization-level context.** Syngraphe is about one repository, which is what
makes "the context belongs to the repository" true rather than aspirational.

## How to read this page

The line between "never" and "postponed" is not about difficulty. It is about whether doing it would
contradict the invariant the tool exists to protect:

> Syngraphe implements the repository-context protocol.
> The repository-context protocol does not depend on Syngraphe.

Anything that would make a repository *need* Syngraphe to remain understandable is in the first
list. Everything else is a question of time.
