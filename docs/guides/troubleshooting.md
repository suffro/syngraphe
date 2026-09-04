---
title: Troubleshooting
description: Every failure Syngraphe can report, what causes it, and how to resolve it.
order: 5
---

# Troubleshooting

Each section is one message you might see, what it means, and what to do about it.

## `Not inside a Git repository.`

```text
Not inside a Git repository.
Syngraphe stores repository context in the repository itself, so it must run inside a Git working tree.
```

Exit code 2. Syngraphe locates the repository with `git rev-parse --show-toplevel` and refuses to
run outside one, because a context directory outside a repository has no history and no reviewer.

Fix: `cd` into the repository, or `git init` if this really is a new project. Check that `git` is on
your `PATH`.

## `The Syngraphe block in AGENTS.md was modified manually.` — `AGENT002`

The managed block no longer matches what this version of Syngraphe writes. Somebody edited it, a
merge mangled it, or it was written by a different version.

Syngraphe will not overwrite it, and `init` refuses to write anything at all while the conflict
stands. Two ways out:

```bash
# Preferred: delete the block, then let init reinstate it.
# Remove everything from <!-- syngraphe:start ... --> to <!-- syngraphe:end --> inclusive.
syngraphe init
```

or restore the expected content by hand — it is printed in
[managed blocks](/reference/managed-blocks).

If you *wanted* different wording there: put it outside the markers. Text outside the block is
yours, is never touched, and never triggers drift.

## `AGENTS.md contains 2 Syngraphe blocks.` — `AGENT003`

Almost always a merge that kept both sides. Delete one of them — they are usually identical — and
re-run.

Syngraphe never guesses which block is authoritative, because choosing wrong would silently discard
whichever one carried the change.

## `AGENTS.md has a Syngraphe start marker without an end marker.` — `AGENT004`

The markers are unbalanced: a start without an end, or an end without a start, usually after a
partial deletion or a bad conflict resolution. The reported line number points at the offending
marker.

Repair the markers by hand, or delete the whole fragment and run `init` again. Syngraphe will not
guess where the block was meant to end, because guessing wrong would consume user-authored text.

## `.context/ already exists and is not a Syngraphe repository context.` — `CTX003`

```text
.context/ exists, has no .context/manifest.json, and contains unrelated entries: notes.txt.
Syngraphe will not modify it. Move or rename it, then re-run.
```

Some other tool — or an earlier convention in your team — already uses that directory name. Nothing
is written, nothing is merged.

Fix: move or rename the existing directory, then re-run. There is no flag to force Syngraphe past
this: a directory it does not recognise may hold work nobody has a copy of.

## `Unsupported context schema version N.` — `MANIFEST003`

Exit code 3. `.context/manifest.json` declares a schema version this build does not know — normally
because the repository was initialized by a newer Syngraphe.

Fix: upgrade Syngraphe (`npm install -g syngraphe@latest`). Do not edit the manifest to make the
number smaller: the version describes the layout on disk, and lowering it makes the declaration a
lie without changing the files.

## `Context manifest is not valid JSON.` — `MANIFEST002`

The manifest was hand-edited into something unparsable, or a merge conflict was committed inside it.
The parser's own message is included as the finding's details.

The file should contain exactly:

```json
{
  "schemaVersion": 1,
  "layout": "standard"
}
```

Restore that and re-run. Syngraphe does not repair it automatically, because a corrupted manifest is
usually a symptom of something larger — an interrupted merge, most often.

## `Referenced path does not exist: ...` — `LINK001`

A context document points at a file that is not there. The finding names the document and the line.

The usual causes are a renamed file, a deleted document that `index.md` still lists, or a typo.
Markdown links resolve relative to the document containing them; inline-code references are also
accepted if they resolve from the repository root, since prose often quotes a repository-relative
path.

## `Expected context file is missing.` — `CTX002`

One of the seven files `init` creates is gone — often a deletion, sometimes a merge. Running
`syngraphe init` again creates exactly the missing files and touches nothing else.

## `Current state contains only headings.` — `STATE002`

A warning, and expected immediately after `init`: the template is headings and nothing else, so the
check is asking you to finish the job. Fill in `.context/state/current.md` and it goes away.

It is a warning rather than an error because an empty state document is a perfectly reasonable
intermediate condition — five minutes after `init`, or on a branch that has not started yet.

## `.context/state/current.md has not changed in N days.` — `STATE001`

A warning, raised only when **both** are true:

- the file's last commit is at least 45 days old, and
- the repository has commits newer than that.

In other words: work happened and the state document did not move. That is a signal worth seeing,
not a verdict — the message says the age and asks you to review, and it never fails a build unless
you asked for `--strict`.

If the state document is genuinely still accurate, say so in it and commit; the age resets, and the
next reader learns that it was checked rather than forgotten.

A repository with no commits since the context was written raises nothing at all.

## `Claude is used but CLAUDE.md has no import of AGENTS.md.` — `CLAUDE001`

A warning. `CLAUDE.md` or `.claude/` exists, so Claude is clearly in use here, but nothing points it
at `AGENTS.md`. Run `syngraphe init` to add the import block.

If you deliberately do not want it, the honest options are to remove the Claude signal from the
repository or to accept the warning. There is no per-check suppression file in v0.1 — see
[scope and non-goals](/concepts/scope-and-non-goals).

## `CLAUDE.md is a symlink that does not point at AGENTS.md.` — `CLAUDE005`

A warning. Syngraphe never writes through a symlink, so it left the file exactly as it found it and
told you instead.

If the symlink target imports `AGENTS.md` itself, everything works and the warning is informational.
Otherwise, point the symlink at `AGENTS.md` or replace it with a regular file and re-run `init`.

## `Refusing to write through a symlink: <path>`

A hard stop rather than a finding. A file Syngraphe was about to write — or one of its parent
directories — is a symbolic link, and following it could write outside the repository.

Fix: resolve the link manually and re-run. This guard has no override.

## `Cannot patch <file>: the file changed since the plan was built.`

The repository changed between planning and applying — usually another process, occasionally an
editor saving in the background. Nothing was written: preconditions are verified for every operation
before the first one is applied.

Fix: re-run the command to build a fresh plan.

## `init` says "Nothing to do" but I expected changes

The context is already initialized and both bootstrap files match what Syngraphe would write. That
is idempotency working. Use `syngraphe status` to see the current state, or `syngraphe check` to see
whether anything is actually wrong.

## Still stuck

Run `syngraphe check --json` and read the raw findings — every message above appears there with its
code, file, line and details. If the behaviour still looks wrong, that JSON is exactly what to
attach to a [bug report](https://github.com/suffro/syngraphe/issues).
