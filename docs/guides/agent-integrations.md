---
title: Agent integrations
description: How AGENTS.md, Claude, Cursor and Codex find the repository context — and how to add another agent.
order: 3
---

# Agent integrations

## `AGENTS.md` is the entry point

Every integration builds on one file. `AGENTS.md` is the canonical bootstrap that coding agents are
expected to read, so Syngraphe puts its pointer there and nowhere else:

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->

This repository maintains shared project context in `.context/`.

Before substantial work, read `.context/index.md` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run `syngraphe check` before completing substantial work.

<!-- syngraphe:end -->
```

Three sentences, deliberately. The block is a pointer, not a policy document: whatever else you want
agents to know goes in your own part of `AGENTS.md`, outside the markers, where Syngraphe never
touches it.

`AGENTS.md` belongs to no single vendor, which is why it is handled by the core rather than by an
agent adapter.

## The agents Syngraphe knows about

| Agent  | Integration                                        | Files written                |
| ------ | -------------------------------------------------- | ---------------------------- |
| Claude | Compatibility shim: `CLAUDE.md` imports `AGENTS.md` | `CLAUDE.md` (managed block)  |
| Cursor | Native — reads `AGENTS.md`                          | none                         |
| Codex  | Native — reads `AGENTS.md`                          | none                         |

### Claude

Claude Code reads `CLAUDE.md`, so the shim is one import:

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->
@AGENTS.md
<!-- syngraphe:end -->
```

That is the whole integration. It is intentionally the thinnest thing that works: the content lives
in `AGENTS.md`, and `CLAUDE.md` only points at it, so the two can never disagree.

Existing setups are respected rather than replaced:

- a `CLAUDE.md` that already has `@AGENTS.md` on a line of its own is left alone;
- a `CLAUDE.md` that is a symlink to `AGENTS.md` is left alone;
- a `CLAUDE.md` with your own instructions gets the import block inserted and keeps everything else;
- a `CLAUDE.md` symlinked to something else is left alone and reported (`CLAUDE005`), because
  Syngraphe never writes through a symlink.

Claude is considered "used in this repository" when `CLAUDE.md` or `.claude/` exists. That detection
only affects reporting: `check` stays quiet about a missing Claude integration in a repository that
shows no sign of using Claude.

### Cursor and Codex

Both read `AGENTS.md` directly, so Syngraphe writes nothing for them. If `.cursor/rules/`,
`.cursorrules` or `.codex/` exist they are detected and listed under `UNCHANGED` — detected for
reporting, never modified.

This is a deliberate limit. Syngraphe is not a rule transpiler: it does not translate or
synchronize hooks, permissions, MCP configuration, subagents, skills or vendor commands. Vendor
features stay vendor-specific. See [scope and non-goals](/concepts/scope-and-non-goals).

## What `status` reports

```text
Agents
  AGENTS.md       ready
  Claude          ready
  Cursor          native
  Codex           native
```

| Status           | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `ready`          | The integration is in place and matches what Syngraphe would write. |
| `native`         | The agent reads `AGENTS.md` directly; nothing is written for it.  |
| `not configured` | The agent is not used in this repository, so nothing is expected. |
| `missing`        | The agent is used here, but its integration is absent.            |
| `drift`          | A managed block was edited by hand.                               |
| `duplicate`      | More than one managed block was found in the file.                |
| `malformed`      | The markers are unbalanced.                                       |
| `skipped`        | A setup Syngraphe deliberately leaves alone, such as a symlink.   |
| `conflict`       | Something that cannot be managed safely, such as a directory.     |

## Adding another agent

Integrations are a registry, not a chain of conditionals. Each one implements a small contract:

```ts
interface AgentIntegration {
  id: string;
  displayName: string;
  findingCodes?: AgentFindingCodes;

  detect(repository: Repository): Promise<AgentDetection>;
  inspect(repository: Repository): Promise<AgentIntegrationState>;
  planIntegration(repository: Repository): Promise<Plan>;
}
```

- `detect` — is this agent used in this repository, and what is the evidence?
- `inspect` — what state is its integration in?
- `planIntegration` — what would it take to put it in the right state? Returns a plan; it never
  writes.

Adding an agent is therefore: one adapter module in `src/agents/integrations/`, one line in the
registry, and tests. Nothing in the core or in the commands branches on agent identity, and an
agent that reads `AGENTS.md` natively can reuse the shared factory in a handful of lines.

An agent that needs no file of its own — the common case, since `AGENTS.md` is becoming the
convention — should stay native. The bar for writing a vendor file is that the agent genuinely
cannot find `AGENTS.md` otherwise.

## A note on the future

A later version may ask an installed agent to perform semantic analysis of the context. That is a
different concern with a different contract (`AgentRunner`), deliberately kept separate from this
one:

- **`AgentIntegration`** — how an agent discovers repository context.
- **`AgentRunner`** — how Syngraphe asks an installed agent to analyse it.

Neither exists in the other's code, and only the first one exists today.
