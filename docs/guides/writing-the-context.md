---
title: Writing the context
description: What belongs in truth, state, decisions and history — and how to keep the documents worth reading.
order: 2
---

# Writing the context

Syngraphe creates the files. What goes in them is the part that matters, and no tool can do it for
you. This page is what has worked.

## The one rule

**Separate what stays true from what is true today.** Everything else follows from that.

A document that mixes "the API is stateless" with "Marta is migrating billing this week" goes stale
as soon as the second sentence expires, and takes the first one's credibility with it. That is why
`truth/` and `state/` are different directories rather than different headings.

## `truth/architecture.md`

The document an agent should read before touching anything. Aim for one screen, not a design doc.

Write:

- what the system is, in three sentences;
- the major components and what each is responsible for;
- how data moves between them;
- external systems it depends on;
- constraints and invariants — the rules that must not be broken, and ideally why.

Skip: anything derivable from the file tree, class-by-class inventories, and anything that will be
wrong in a month.

<ExampleNote>Invented, to show the level of detail. No command writes anything like it.</ExampleNote>

```md
## Important constraints

- The API must stay stateless: any instance may serve any request.
- The outbox table is the only path for outbound events. Direct publishing from
  request handlers has caused duplicate deliveries twice.
```

The second half of that last line is the part worth writing. A rule with its reason attached
survives; a rule without one gets "cleaned up" by the next person.

## `truth/conventions.md`

Conventions that are load-bearing, not preferences a formatter already enforces.

Write: the build, test and lint commands; how tests are organized; error and logging conventions;
what "done" means here; the rules whose violation would fail review.

Skip: indentation, quote style, import order — if a formatter enforces it, documenting it only
creates a second source of truth that will disagree eventually.

## `state/current.md`

The most perishable file, and the most useful when it is fresh. Four headings, kept short —
`syngraphe init` writes the headings and leaves them empty.

<ExampleNote>Invented, to show what filling them in looks like.</ExampleNote>

```md
## Current focus

Migrating billing off the legacy schema.

## Recent relevant changes

- `invoices` is now written by the worker, not the API.
- Legacy `billing_v1` writes are behind a feature flag, default off.

## Next

- Backfill historical rows, then delete the legacy table.

## Blockers

- Waiting on the finance export before the backfill can run.
```

Update it when the answer to "what are we doing right now" changes — typically at the start or end
of a work session, and always in the same commit as the work it describes. `syngraphe check` warns
(`STATE001`) when this file has not changed while the repository has, and warns (`STATE002`) when it
is nothing but headings.

## `decisions/`

One Markdown file per significant decision. Not every commit deserves one — the test is whether a
future reader would otherwise ask "why on earth is it like this?".

A shape that works:

<ExampleNote>A suggested shape, filled with placeholder prose. Nothing enforces it.</ExampleNote>

```md
# Managed-block padding is unconditionally reversible

## Decision

What was decided, in one or two sentences.

## Why

The reasoning, including the constraint that forced it.

## Rejected alternatives

- **The obvious approach.** Why it was not taken.
- **The other obvious approach.** Why that one was not either.
```

The rejected alternatives are the most valuable section and the one most often left out. Without it,
the next person re-litigates the decision from scratch — and frequently reverses it.

Name files so they sort: `0001-....md`, `0002-....md`. Syngraphe counts `.md` files in the directory
(excluding `README.md`) for `syngraphe status`; nothing else about the naming is enforced, and no
ADR workflow is imposed.

## `history/`

Where context goes when it stops being current — a finished migration, a retired subsystem, the
state document from a project phase that ended.

Move rather than delete. The knowledge stays available to anyone reading back, without sitting in the
default reading path where it would compete with what is currently true.

## `index.md`

The router. The generated version points at the standard files, grouped by how often they are
relevant:

<ExampleNote label="Generated">The body of <code>.context/index.md</code> as <code>syngraphe init</code> writes it — the one generated document that arrives with content.</ExampleNote>

```md
## Always relevant

- `truth/architecture.md` — current system architecture.
- `state/current.md` — current project state and active work.

## When relevant

- `truth/conventions.md` — repository conventions.
- `decisions/` — significant technical and architectural decisions.

## Historical

- `history/` — completed, historical, or superseded operational context.
```

Extend it when you add documents. `syngraphe check` verifies that every local path referenced here —
in Markdown links and in inline code — actually exists (`LINK001`), so a stale pointer is caught
rather than followed.

## Writing for two audiences at once

The same document is read by a person skimming for orientation and by an agent that will act on it.
That pushes in one direction, not two:

- **Say the constraint, not the vibe.** "The API must stay stateless" beats "we try to keep things
  stateless".
- **Prefer specifics that can be checked.** Paths, command names, table names.
- **State the reason for anything counter-intuitive.** It is what stops both audiences from
  "fixing" it.
- **Delete what has expired.** An out-of-date line is worse than a missing one, because it is
  trusted.

## Keeping it current

The habit that makes this work: when a change alters what the context says, change the context in
the same commit. It is one more file in a diff a reviewer is already reading, and it is the only
version of this practice that survives contact with a deadline.

The managed block Syngraphe writes into `AGENTS.md` asks agents to do exactly that, which is most of
why the block exists.
