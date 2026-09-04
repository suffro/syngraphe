---
title: Design decisions
description: The choices behind Syngraphe v0.1, the reasoning, and the alternatives that were rejected.
order: 4
---

# Design decisions

Each entry is a decision, why it was made, and what was rejected. The rejected alternatives are the
part worth keeping: without them the same choices get re-litigated from scratch.

## Context lives in the repository, not in a service

**Decision.** `.context/` is committed Markdown. There is no server, no account, no index.

**Why.** Context that lives outside the repository is invisible in review, unavailable to colleagues
on other tools, and lost when the vendor is. Context inside it is versioned, branchable, diffable
and portable for free — Git already solved every problem a context store would have to solve again.

**Rejected.** A hosted memory service (invisible in review, vendor-locked). A local database
(unreviewable, unmergeable, another artefact to keep in sync). Embedding context in code comments
(no place for the parts that are not about one file).

## Markdown, with exactly one JSON file

**Decision.** Everything is Markdown except `manifest.json`, which holds two fields.

**Why.** The context must be readable and editable without any tooling. The manifest exists only so
a future version can tell which layout it is looking at before touching anything — that single check
is worth one small machine-readable file.

**Rejected.** YAML frontmatter carrying structured metadata in every document (turns prose into a
schema people get wrong). No manifest at all (a future migration would have to infer the layout).

## No timestamps or machine identifiers in the manifest

**Decision.** The manifest holds `schemaVersion` and `layout`. Nothing else.

**Why.** A generation timestamp, a tool version, a machine or agent name would change on every run,
producing diff noise and merge conflicts that carry no information. Git already records when, by
whom, and in which commit.

**Rejected.** Recording the generating version "for debugging" — the information is in
`git log`, and a field that changes on every run is a field that will conflict on every merge.

## The lifecycle split

**Decision.** Four directories: `truth/`, `state/`, `decisions/`, `history/`.

**Why.** Stable and volatile facts have different half-lives, and mixing them means the whole
document is discounted the moment the volatile part expires. See
[the context model](/concepts/context-model).

**Rejected.** One `CONTEXT.md` (everything inherits the credibility of its most stale sentence).
A directory per subsystem or per team (every write becomes a filing decision, every read becomes a
search).

## Managed-block padding is unconditionally reversible

**Decision.** Exactly one blank line before the block when content precedes it; never one after.

**Why.** Removing the block must return the file to its exact previous bytes. Conditional padding —
"add a blank line only if the neighbour is not blank" — cannot be undone, because removal has no way
to tell an inserted blank line from a user-authored one. Making the leading separator unconditional
removes the ambiguity; omitting the trailing one avoids a double blank line in the common
heading-then-blank layout, since the original spacing simply follows the block instead.

**Rejected.** Symmetric padding (reversible, but leaves a double blank line in most real files).
Collapsing blank runs on removal (loses the original spacing in files that had none). Storing a hash
of the block or its padding (repository noise for a problem a stricter insertion rule solves
outright).

## Drift is reported, never repaired

**Decision.** A hand-edited managed block blocks `init` and produces an error from `check`.

**Why.** The edit may have been deliberate. Overwriting it silently discards a decision somebody
made, and Syngraphe cannot tell that case from a mangled merge.

**Rejected.** Auto-repair with a `--force` escape hatch (the flag becomes muscle memory, and then
the guarantee is gone). Auto-repair with a backup file (litter in the repository, and a backup
nobody reads).

## Conflicts abort the whole run

**Decision.** If any part of the plan is blocked, nothing is applied.

**Why.** A partially applied plan leaves the repository in a state neither the tool nor the user
predicted. Deterministic refusal is easier to reason about, and the fix is usually one deleted block
away.

**Rejected.** Applying the unblocked operations and reporting the rest (the second run then starts
from a state the first run invented).

## Plan, then apply — with `--dry-run` on the same path

**Decision.** Inspection, planning, rendering and applying are separate stages, and `--dry-run`
stops after rendering.

**Why.** A dry run implemented separately from the real run is a second implementation that will
eventually disagree with the first — and it will disagree exactly when it matters. Sharing the
planner makes the preview a guarantee rather than a description.

**Rejected.** A `dryRun` boolean threaded through the writing code (the same code path, but with the
writes conditionally skipped — one missed branch and the "dry" run writes).

## Freshness is a warning with an age, never an error

**Decision.** `STATE001` is a warning, raised only when the state document is at least 45 days old
**and** the repository has newer commits. The message states the age and asks for a review.

**Why.** Age is a signal, not a verdict: a document can be old and perfectly accurate. A tool that
declares "context is stale" on a timer teaches people to ignore it, which costs more than saying
nothing would have.

**Rejected.** Age alone (a repository nobody touched for a year would be permanently red). An error
severity (fails builds for a judgement call). A configurable threshold in v0.1 (a knob invites
tuning the number until the warning goes away).

## `AGENTS.md` is the only bootstrap

**Decision.** One canonical file. Claude gets a one-line import; Cursor and Codex get nothing.

**Why.** Every additional vendor file is another copy of the same instruction that can drift.
`AGENTS.md` is becoming the convention, and an agent that reads it needs nothing else.

**Rejected.** Writing a rules file per vendor (n copies to keep in sync, and Syngraphe becomes a
transpiler — explicitly not the goal). Putting the context inline in `AGENTS.md` (the file becomes
the context instead of pointing at it, and the lifecycle split is lost).

## Integrations and checks are registries

**Decision.** Agents and checks are lists of small objects, consumed by commands.

**Why.** Adding either should be one module, one registration, and tests — not an edit to a
conditional in the core. Agent-specific knowledge that leaks into shared code is how tools like this
become unmaintainable.

**Rejected.** Conditionals in the commands (`if (agent === "claude")` in three places, guaranteed to
diverge). A plugin system loading external modules (a security and versioning surface v0.1 has no
use for).

## Only two Git commands, through `execFile`

**Decision.** `rev-parse --show-toplevel` and `log -1 --format=%cI`, invoked with an argument array.

**Why.** That is all v0.1 needs. `execFile` with an array cannot interpret a repository path as a
shell command. When Git cannot answer, the answer is "no information", and dependent checks stay
silent.

**Rejected.** `simple-git` or a libgit binding (a dependency and a native build for two commands).
Shell strings (quoting bugs at best).

## Stable codes from the first release

**Decision.** `CTX001`, `MANIFEST003`, `AGENT002`, `LINK001`, `STATE001` and the rest are fixed
identifiers, and the JSON payload carries a version.

**Why.** CI configuration will refer to them. A code that changes meaning between versions silently
breaks a pipeline that looked fine.

**Rejected.** Deriving codes from internal names (renaming a module would rename the contract).
Adding codes later, once the set settles (the first users' pipelines are the ones that break).

## Named exit codes, documented

**Decision.** `0` success, `1` integrity failure, `2` usage, `3` unsupported schema, `4` internal.

**Why.** `3` in particular pays for itself: it is the one failure whose fix is on the tooling side
(upgrade Syngraphe) rather than in the repository, and a script can act on that distinction.

**Rejected.** Only `0` and `1` (the caller cannot tell "your context is broken" from "your tool is
too old").

## No AI in the deterministic core

**Decision.** No model calls anywhere in v0.1. If semantic analysis arrives, it will run through an
installed agent and stay optional.

**Why.** The core must work offline, in CI, in an air-gapped environment, and produce the same
answer twice. A tool that needs a key to tell you a file is missing is a tool that stops working at
the worst moment.

**Rejected.** Direct provider integrations (`--provider openai`) — a key, a bill, a rate limit and a
non-deterministic answer, in exchange for checks that must stay conservative anyway.
