---
title: The context model
description: Truth, state, decisions and history — why repository context is split by lifecycle rather than by topic.
order: 1
---

# The context model

## The distinction that matters

Repository context is not one kind of thing. Two facts about the same system can be equally true
today and have completely different half-lives:

- *The API must stay stateless.* True for years. Load-bearing. Breaking it breaks production.
- *Marta is migrating the billing tables this week.* True for a fortnight, then actively misleading.

Written into the same document, the second one poisons the first. A reader who catches one stale
sentence has no way to tell which other sentences went stale with it, so they discount the whole
file — and a document nobody trusts is a document nobody maintains.

Syngraphe therefore splits context by **lifecycle**, and the directory names are the lifecycles:

| Directory    | Lifecycle | Half-life        | Contains                                                        |
| ------------ | --------- | ---------------- | --------------------------------------------------------------- |
| `truth/`     | stable    | months to years  | architecture, conventions, domain concepts, constraints, invariants |
| `state/`     | volatile  | days to weeks    | current focus, recent relevant changes, next steps, blockers    |
| `decisions/` | append    | permanent        | what was decided, why, and what was rejected                    |
| `history/`   | archive   | permanent, inert | completed or superseded operational context                     |

## Truth

What is stably true about the system. The document an agent should read before touching anything,
and the one a new colleague reads on their first morning.

Two files by default:

- **`truth/architecture.md`** — what the system is, its major components, how data moves, what it
  depends on, and the constraints that must not be broken.
- **`truth/conventions.md`** — the repository's conventions, the development workflow, and the rules
  whose violation would fail review.

The test for whether something belongs here: *would this still be true after the current work is
finished?* If yes, it is truth. If it names a person, a sprint, or a branch, it is state.

Truth changes — architectures do — but it changes deliberately, in a commit whose subject is the
change itself.

## State

What is true right now. The most perishable content in the repository and the most useful when it is
current, because it is the part an agent cannot infer from the code.

Four headings: current focus, recent relevant changes, next, blockers.

It is a separate directory rather than a section of the architecture document for one reason: so
that it can go stale **visibly**, without dragging anything else down with it. `syngraphe check`
watches this file specifically, warning when it has stopped moving while the repository has not
(`STATE001`) and when it contains only headings (`STATE002`).

## Decisions

Why things are the way they are, one Markdown file per decision.

This is the context that is hardest to reconstruct and most expensive to lose. Code shows what was
chosen; only a decision record shows what was rejected and why — and without that, the next person
re-runs the same analysis, often reversing the choice for reasons the original author had already
considered and dismissed.

The rejected alternatives are the valuable part. A decision record without them is a description of
the present, which the code already provides.

For v0.1 this is a Markdown directory and nothing more: no ADR workflow, no numbering enforcement,
no status lifecycle. `syngraphe status` counts the files; nothing else is imposed.

## History

Where context goes when it stops being current: a finished migration, a retired subsystem, the state
document from a phase that ended.

Moving rather than deleting matters because the knowledge is still worth having — it explains the
shape of what is there now. Keeping it out of the default reading path matters too: an archive
mixed into the active context competes with what is currently true, which is exactly the failure the
whole model exists to prevent.

## The index as router

`.context/index.md` is what a reader — human or agent — hits first. It groups the documents by how
often they are worth reading rather than by directory:

```md
## Always relevant
## When relevant
## Historical
```

That grouping is the model's user interface. `truth/architecture.md` and `state/current.md` are
always relevant; conventions and decisions are consulted when the task calls for them; history is
there when someone asks how things got this way.

`syngraphe check` verifies that every path this file points at exists, because a router with a dead
link sends readers nowhere and quietly stops being maintained.

## Why not one file, or a dozen directories

**One file** is what most repositories start with, and it fails at exactly the point described
above: everything in it inherits the credibility of its most stale sentence.

**A dozen directories** — one per concern, per team, per subsystem — fails differently. Every extra
directory is a judgement call at write time ("does this go in `security/` or `architecture/`?") and a
search at read time. Four lifecycles need no judgement: the question "will this still be true next
quarter?" has an obvious answer for almost every sentence anyone writes.

Four is also small enough that the whole model fits in the one-paragraph bootstrap block in
`AGENTS.md`, which is what makes it usable by an agent that has never seen this repository before.

## The invariant underneath

The model is Markdown files in directories with agreed names. That is deliberate: it means the model
works with a text editor, survives without the tool, and can be adopted by another implementation
without permission.

> Syngraphe implements the repository-context protocol.
> The repository-context protocol does not depend on Syngraphe.
