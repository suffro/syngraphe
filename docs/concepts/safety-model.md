---
title: Safety model
description: What Syngraphe guarantees about your files, what it refuses to do, and how each guarantee is enforced.
order: 3
---

# Safety model

Syngraphe edits files that people also edit by hand. That makes conservatism a feature rather than a
style, and it is the reason several obvious conveniences are absent.

## The guarantees

### It owns only what is between its markers

Text outside `<!-- syngraphe:start ... -->` and `<!-- syngraphe:end -->` is never read for meaning,
never reformatted, never reordered, and never removed. Line endings and the presence or absence of a
final newline are preserved as found.

Enforced by the managed-block subsystem, which is pure text manipulation and tested against CRLF
files, files with no final newline, files with and without a leading heading, and empty files.

### Insertion is exactly reversible

Remove the managed block from a file Syngraphe patched and you get the original bytes back.

This is why the padding rule is what it is: exactly one blank line before the block when content
precedes it, and none after. Conditional padding could not be undone, because removal cannot tell an
inserted blank line from one you wrote. The property is asserted by a test that patches a file,
removes the block, and compares to the original — for several file shapes, including CRLF and no
trailing newline.

### Drift is reported, never overwritten

A managed block whose content differs from what Syngraphe would write is reported as drift. It is
never silently replaced, because Syngraphe cannot distinguish a deliberate edit from a mangled merge
— and overwriting would destroy the former.

The same applies to duplicate blocks and unbalanced markers: reported with a line number, never
guessed at.

### Initialization is idempotent

A second `init` on an initialized repository writes nothing and leaves no diff. Asserted by a test
that snapshots the whole working tree before and after.

### Nothing is applied when the plan has conflicts

If any part of the plan is blocked, `init` renders the conflict and stops. No operation runs.

A partially applied change is harder to reason about than one that did not happen, and there is no
flag to force past this: fix the conflict, then run again.

### Writes are complete or absent

Every write goes to a temporary file in the destination directory and is then renamed into place. An
interrupted run leaves either the old file or the new one, never half of either.

### Nothing is written outside the Git root

Paths are resolved against the repository root, and anything that escapes it — `..`, an absolute
path — is rejected before any filesystem call.

### Nothing is written through a symlink

Before writing, every path segment from the root down is checked. A symlink anywhere along the way
is refused:

```text
Refusing to write through a symlink: CLAUDE.md
CLAUDE.md is reached through a symbolic link. Resolve it manually and re-run.
```

There is no override. Directory walks likewise use `lstat` and do not follow links, so a symlink
inside `.context/` cannot lead a check out of the repository.

### An unrecognised `.context/` is never touched

If `.context/` exists, has no Syngraphe manifest, and contains entries Syngraphe does not recognise,
`init` aborts with an explanation. It does not merge, does not adopt, and does not "clean up" — the
directory may hold work nobody has another copy of.

### Nothing leaves the machine

No network calls, in any command. No telemetry, no update checks, no model calls. `status` and
`check` do not even write.

### No hooks, no background processes

Installing Syngraphe installs a binary. It does not write to `.git/hooks`, does not register a
daemon, and does not modify any configuration outside the files listed in its plan.

## What it refuses to do

| Refusal                                      | Why                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Overwrite a hand-edited managed block        | The edit may have been deliberate.                                   |
| Pick one of two duplicate blocks             | Choosing wrong discards whichever carried the change.                |
| Guess where a malformed block ends           | Guessing wrong consumes user-authored text.                          |
| Adopt an unrelated `.context/`               | It may belong to another tool, or hold irreplaceable work.           |
| Write through a symlink                      | The target may be outside the repository.                            |
| Downgrade an unsupported schema              | The version describes the files; lowering it makes it a lie.         |
| Rewrite existing context files to templates  | Your content is not Syngraphe's to normalise.                        |
| Delete anything                              | v0.1 has no destructive operation at all.                            |

## Destructive removal, and why it is not here

A command that removes the repository context will exist eventually. It is deliberately absent from
v0.1, and when it arrives it must:

- show exactly what would be removed, before removing it;
- preserve all user-authored content outside managed blocks;
- treat `.context/` as potentially containing valuable human-authored data;
- require an explicit confirmation phrase — not a `--yes` flag;
- not be called `uninstall`, because it does not remove a program, it removes your writing.

Shipping the additive half first is the point: a tool that can only add is one you can try on a real
repository this afternoon.

## Reviewing what it did

The final safety property is that the diff is small enough to read:

```bash
syngraphe init --dry-run   # what would happen
syngraphe init             # do it
git diff                   # exactly what happened
```

On an existing `AGENTS.md`, the change is ten added lines and nothing else. That is the design goal
— not "trust the tool", but "the tool's output fits on one screen and you can check it".
