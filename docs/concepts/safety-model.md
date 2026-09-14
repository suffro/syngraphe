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

Preserving bytes means reading them exactly. A file that is not valid UTF-8 cannot be edited as text
without replacing the bytes that failed to decode, so it is reported as a conflict — `AGENT005` for
`AGENTS.md` — and left alone. A UTF-8 byte order mark is kept.

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

### A dry run changes nothing

`--dry-run` runs the same planner as the real command and performs no repository mutations: it does
not modify repository contents or Git state.

Enforced twice. Planners receive a read-only view of the repository whose type has no method that
writes, so a planner that tried to write would not compile. And one test runs every mutating
command with `--dry-run`, with and without `--json`, in a repository with untracked, staged and
unstaged changes, then compares the working tree, `HEAD`, the index, refs, config and Git's own
status before and after.

### Machine-readable dry runs expose no file bodies

`--dry-run --json` renders the same plan as the human preview and stops before apply. Its public
projection contains operation types, scope-relative paths, summaries, unchanged reasons and
conflicts. It deliberately omits created contents and patch before/after text, so repository prose
is not dumped into automation logs. `--json` without `--dry-run` is rejected as usage error before
planning or writing.

### Writes are complete or absent

Every write goes to a temporary file in the destination directory and is published from there. An
interrupted run leaves either the old file or the new one, never half of either.

The exception is a filesystem without hard links — FAT, some network shares. There a file is
published with an exclusive create and a write instead: still exclusive, but a crash during that
write can leave the new file partial.

### A new document is never created twice

A create is linked into place, which fails if the destination exists — so the question "is this
path free?" and the act of claiming it are a single filesystem operation.

This matters when two Syngraphe runs create the same document at once. Both can plan it while the
path is still missing, and both can pass their preflight; exactly one then publishes, and the other
stops with an integrity failure rather than replacing a file it never read:

```text
Cannot create .context/decisions/retry-policy.md: it already exists.
The repository changed after the plan was built. Re-run the command.
```

Filesystems without hard links — FAT, some network shares — still decide a single winner, because
the file is created there with an exclusive open instead. Only on those filesystems does the created
file become visible before its contents land.

### A concurrent edit is never overwritten

A patch records the exact bytes it expects to replace. They are compared before the first write,
and compared again as part of publishing: the file is renamed aside, the moved bytes are compared,
and only then is the new file linked into place. If they differ, the original goes back under its
name and the run stops with an integrity failure. An edit made after the plan was built survives,
instead of being replaced by content computed from an older version.

If something recreates the path during that step, neither file is discarded: the run stops and
names where the moved-aside file was kept. On Windows, a file another program holds open cannot be
moved aside; the run stops without changing anything. Two Syngraphe runs patching the same file at
once on Windows can both move it: one publishes, and the other reports the file changed or stops
with the moved file kept.

One writer is out of reach: a process that already has the file open and writes through that open
handle after the comparison. Its write lands in the file that was moved aside. Node offers no way to
exclude it.

### Paths must stay inside the selected scope

Paths are resolved against the selected scope (the repository root by default), and anything that escapes it — `..`, an absolute
path — is rejected before any filesystem call.

### Symlinks and changed parents are rejected

Before writing, every path segment from the root down is checked. A symlink found along the way
is refused:

```text
Refusing to write through a symlink: CLAUDE.md
CLAUDE.md is reached through a symbolic link. Resolve it manually and re-run.
```

There is no override. Directory walks likewise use `lstat` and do not follow links, so a symlink
inside `.context/` cannot lead a check out of the repository.

Writes remember each parent directory's identity (device and inode), including the Git root, and
recheck it during directory creation, staging, publication, fallback and cleanup. Newly needed
directories are created one level at a time. Staged files use exclusive creation and are written
through their open handle after another directory check. A detected replacement stops the operation,
including cleanup: temporary files may remain in the moved directory, and an interrupted patch
reports the original's temporary name for recovery. IO failures such as `ENOENT`, `EIO` and `ENOSPC`
are propagated, not retried as a hard-link fallback.

This is protection against detected concurrent changes, not a security sandbox. A hostile process
with write access to the directory tree can still exchange a parent between a check and an individual
filesystem call. Node's portable filesystem API does not offer directory-handle-relative mutation
primitives to eliminate that interval. Run mutating commands only in a workspace whose directory
tree is trusted; these checks do not isolate untrusted processes running with the same permissions.

### An unrecognised `.context/` is never touched

If `.context/` exists and nothing identifies it as a repository context, `init` aborts with an
explanation. A manifest identifies it by declaring the protocol. Without that declaration only the
complete standard shape does: every top-level entry a standard one of its standard kind, and at
least one standard document present. A lone `truth/` directory is not enough. It does not merge, does not adopt, and does not "clean up" — the
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
| Replace a file another run just created      | The losing run never read what it would destroy.                     |
| Overwrite an edit made after planning        | The run compared an older version, not the one it would destroy.     |
| Patch a file that is not valid UTF-8         | Bytes that do not decode would be rewritten.                         |
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
