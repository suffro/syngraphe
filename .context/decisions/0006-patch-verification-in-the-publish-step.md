# Patch verification lives in the publish step

## Decision

A `patch` operation is verified by the operation that publishes it, not only by the apply preflight.
`replaceTextFileIfUnchanged` in `src/core/fs.ts` stages the new file, renames the destination aside
to `.syngraphe-<hex>.aside`, compares the moved bytes with the plan's `before`, and then links the
staged file into place. When the bytes differ, the original is linked back and the call returns
false, which `applyPlan` reports as "changed since the plan was built" (exit code 1). When the path
is recreated while the original is aside, nothing is discarded: the call fails and names the aside
file.

The preflight comparison stays, and now compares bytes. It still stops an ordinary stale plan before
anything is written.

## Why

The preflight compared `before` and then published with a rename, which replaces whatever is there.
An edit landing between the two was silently lost. That matters most for `state archive`, whose
second operation resets `state/current.md` — the file a person or an agent is most likely to be
editing at that moment.

Creates had the same race and were closed by claiming the path with `link`. Patches need the same
shape: the check has to be part of the operation that makes the result visible. Renaming aside first
means the compared bytes are no longer reachable by name, so a writer that opens the path afterwards
cannot change them, and the publishing `link` fails if such a writer created a new file.

## Accepted residual

A process that already holds the original open and writes through that descriptor after the
comparison is not excluded. Its write lands in the file moved aside, which is then removed. Node
exposes no primitive — no mandatory lock, no `renameat2(RENAME_EXCHANGE)` — that would close that
window portably. For a moment the path is also absent, which a concurrent reader can observe.

On Windows a file held open by another program cannot be renamed. That fails closed with an
integrity error before anything has moved, and it is not retried. Without hard links the publish
falls back to an exclusive create, which keeps exclusivity but not "complete file or nothing".

A Windows rename also goes through a handle opened by name, so two concurrent runs can both move
the same file; hosted CI showed it. A run that finds its moved file already gone reports the file as
changed. If both runs read it, only one can publish and the other fails closed, keeping the file it
moved. Exclusivity holds on every platform; only the losing run's error differs.

## Rejected alternatives

- **Read, compare, rename over.** The previous behaviour, and the race this decision removes.
- **Compare again immediately before the rename.** Narrows the window without closing it.
- **Advisory locks.** Only other Syngraphe runs would honour them; editors and agents would not.
- **Retrying a busy file.** A retry races the process holding the file and can replace what it has
  just written.
- **Keeping the blind rename and documenting the race.** The guarantee in the documentation would
  still be one the code does not give.
