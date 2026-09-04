---
title: What is Syngraphe
description: A Git-native tool that keeps repository context correct, current, reviewable and readable by humans and coding agents alike.
order: 1
---

# What is Syngraphe

Syngraphe keeps repository context versioned, current, and understandable by both humans and coding
agents.

Concretely, it does three things:

1. **`syngraphe init`** creates `.context/` — a small set of Markdown documents describing the
   repository — and adds a managed block to `AGENTS.md` telling agents to read them.
2. **`syngraphe status`** summarizes what that context currently contains.
3. **`syngraphe check`** verifies that the context is structurally intact and that the agent
   bootstrap has not drifted.

That is the whole of version 0.1. There is no server, no account, no index to rebuild, and no AI
call anywhere in the tool.

## What "repository context" means here

Every repository carries knowledge that is not in the code: why the architecture looks like this,
which conventions are load-bearing, what is being worked on right now, what was decided and
rejected two months ago. That knowledge usually lives in chat threads, tickets, and people's heads.

Syngraphe gives it a home in the repository itself:

```text
.context/
├── manifest.json          # schema version and layout
├── index.md               # router into the context
├── truth/                 # stable facts: architecture, conventions
├── state/                 # volatile facts: current focus, next steps, blockers
├── decisions/             # what was decided, and why
└── history/               # what used to be true
```

The split is by **lifecycle**, not by topic — see [the context model](/concepts/context-model) for
why that distinction is the one that matters.

## The philosophy

- **The context belongs to the repository, not to Syngraphe.** It is committed, reviewed in pull
  requests, and branched with the code it describes.
- **Git provides history and versioning.** No separate database, no second timeline.
- **Markdown is the primary format.** Anyone can read and edit the context with a text editor.
- **Humans and agents read the same documents.** There is no agent-only copy to keep in sync.
- **The repository stays usable without Syngraphe.** If the executable disappears, `.context/`,
  `AGENTS.md`, Markdown and Git history remain complete and meaningful.
- **The deterministic core works offline and without AI.** Optional AI support may come later; it
  will never be required.

The architectural invariant, stated plainly:

> Syngraphe implements the repository-context protocol.
> The repository-context protocol does not depend on Syngraphe.

## What it is not

Syngraphe is not a memory service, not a rule transpiler, and not a wrapper around a model. It does
not synchronize hooks, permissions, MCP configuration, subagents or skills between vendors — those
are vendor concerns and stay that way. See
[scope and non-goals](/concepts/scope-and-non-goals) for the full list, including what is
deliberately postponed.

## Who it is for

- Teams whose repositories are read by coding agents as well as people, and who are tired of
  re-explaining the same architecture in every session.
- Maintainers who want the "why" behind a decision to survive the person who made it.
- Anyone who wants project knowledge to be reviewable in a diff instead of trusted from memory.

## Next

- [Why Syngraphe](/getting-started/why-syngraphe) — the argument in full.
- [Installation](/getting-started/installation) — requirements and install options.
- [Quickstart](/getting-started/quickstart) — a first run, start to finish.
