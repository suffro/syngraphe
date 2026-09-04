---
title: Why Syngraphe
description: The case for keeping project knowledge inside the repository, in Markdown, versioned by Git and shared between humans and agents.
order: 2
---

# Why Syngraphe

## The problem

A repository tells you what the code does. It rarely tells you:

- why the architecture is shaped this way, and what was tried before;
- which conventions are load-bearing and which are incidental;
- what is being worked on right now, and what is blocked;
- which constraint the odd-looking function is protecting.

That knowledge exists, but it lives outside the repository: in chat threads, in tickets, in
review comments, in the head of whoever wrote it. It drifts silently, it is invisible in code
review, and it is lost when the person or the tool that held it goes away.

Coding agents make this sharper rather than new. An agent starts every session with no memory of
your project. Whatever it is not told, it infers — and an inference that sounds plausible is
exactly the kind of wrong that survives review.

## The three usual answers, and why they fall short

**Tell the agent every time.** Works, and costs you the same explanation forever. It also produces
as many versions of the truth as there are conversations.

**Put it in a vendor's memory feature.** The knowledge is now real but invisible: not in the diff,
not in code review, not available to the colleague using a different tool, and not portable when
you change tools.

**Write a long `AGENTS.md`.** Better — it is in the repository. But one flat file mixes what is
stably true with what is true this week. The volatile part goes stale first and quietly discredits
the rest.

## The position Syngraphe takes

Repository context is repository content. It is committed, reviewed, branched, and versioned like
everything else.

That has consequences worth stating explicitly:

- **It is reviewable.** A pull request that changes the architecture also changes
  `truth/architecture.md`, and a reviewer sees both.
- **It is versioned by Git.** `git log .context/` is the history. `git blame` says who claimed what
  and when. There is nothing to migrate and no second timeline to keep in sync.
- **It is branchable.** Context on a feature branch describes that branch. It merges — or
  conflicts — like code.
- **It is shared.** People read the same files agents do. No export step, no per-vendor copy.
- **It survives its tooling.** Markdown in Git outlives any CLI, this one included.

## Why the lifecycle split matters

The single biggest reason context rots is that stable and volatile facts get written into the same
document. "We use PostgreSQL" and "Marta is currently migrating the billing tables" have completely
different half-lives, and mixing them means the whole document is suspect the moment the second
sentence expires.

Syngraphe separates them by directory: `truth/` for what is stably true, `state/` for what is true
right now, `decisions/` for what was decided, `history/` for what used to be true. A reader — human
or agent — can then trust `truth/` while treating `state/` as perishable, which is the correct
disposition for both.

## Why a tool at all

If the context is just Markdown in Git, why install anything?

Because two things need enforcing, and neither is interesting to do by hand:

1. **The bootstrap.** Agents have to be told the context exists. That means a block in `AGENTS.md`
   that is identical in every repository, added without disturbing whatever else is in the file, and
   detectable when someone edits it.
2. **The integrity.** Files go missing, links break, the manifest gets hand-edited, a managed block
   gets half-deleted in a merge, the state document stops being touched while the repository moves
   on. `syngraphe check` catches those deterministically, offline, with stable codes a CI job can
   depend on.

Everything else — the content, the judgement, the writing — stays yours.

## What Syngraphe deliberately does not claim

It does not verify that your architecture document is *true*. No offline check can. What it verifies
is structural: the files exist, the references resolve, the managed blocks are intact, and the state
document has not silently fallen behind the repository. Freshness is reported as a signal with its
age attached, never as a verdict.

Overclaiming here would be worse than useless: a green check that implies semantic correctness is a
reason to stop reading, which is the opposite of the point.

## Next

- [Installation](/getting-started/installation)
- [Quickstart](/getting-started/quickstart)
- [The context model](/concepts/context-model) — the four lifecycles in detail.
