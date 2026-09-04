---
title: Managed blocks
description: The markers, the placement rules, the exact contents, and what drift means.
order: 3
---

# Managed blocks

A managed block is the region of a Markdown file that Syngraphe owns. Everything outside it is
yours, permanently.

## The markers

```md
<!-- syngraphe:start version="1" -->
...managed content...
<!-- syngraphe:end -->
```

They are HTML comments, so they render as nothing in every Markdown viewer, and they carry a version
so a future block format can be recognised rather than misread.

Marker lines are matched after trimming surrounding whitespace, and the version attribute is parsed:
a block declaring a version this build does not manage is reported rather than touched.

## What is written

### `AGENTS.md`

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->

This repository maintains shared project context in `.context/`.

Before substantial work, read `.context/index.md` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run `syngraphe check` before completing substantial work.

<!-- syngraphe:end -->
```

No `##` heading wraps it: a heading would enter your document's outline and change how the file
reads, which is not Syngraphe's to decide.

### `CLAUDE.md`

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->
@AGENTS.md
<!-- syngraphe:end -->
```

## Placement

1. If the file begins with a top-level `# Heading`, the block goes immediately after that heading.
2. Otherwise it goes at the very beginning of the file.
3. Everything else stays exactly where it was.

A `##` heading on the first line is not a title for this purpose — only a real `#` heading is.

### The padding rule

Exactly one blank line is inserted **before** the block when content precedes it, and nothing is
inserted after it.

That asymmetry is deliberate and load-bearing. Padding added conditionally ("add a blank line only
if the neighbour is not blank") cannot be undone later, because removal has no way to tell an
inserted blank line from one you wrote. Making the leading separator unconditional removes the
ambiguity; omitting the trailing one avoids a double blank line in the common heading-then-blank
layout, since the spacing that followed the insertion point simply follows the block instead.

The result: removing the block returns the file to its exact previous bytes. That is a tested
property, not an aspiration — see [design decisions](/concepts/design-decisions).

## What is preserved

| Property                | Guarantee                                                    |
| ----------------------- | ------------------------------------------------------------ |
| Existing content        | Never replaced, reformatted, reordered or re-indented.       |
| Line endings            | A CRLF file stays CRLF; an LF file stays LF.                 |
| Final newline           | A file without one keeps not having one.                     |
| Everything outside      | Byte for byte identical.                                     |

## States a block can be in

| State                 | Meaning                                                         | What Syngraphe does           |
| --------------------- | --------------------------------------------------------------- | ----------------------------- |
| `absent`              | No block in the file.                                           | Inserts one.                  |
| `valid`               | Exactly one block, matching the expected content.               | Nothing.                      |
| `drift`               | Exactly one block, content differs.                             | Reports it. Never overwrites. |
| `unsupported-version` | A block whose marker declares another version.                  | Reports it.                   |
| `duplicate`           | More than one block in the file.                                | Reports it.                   |
| `malformed`           | A start without an end, an end without a start, or nesting.     | Reports it, with a line number. |

Comparison ignores trailing whitespace on each line and leading or trailing blank lines inside the
block, so a reformatting editor does not manufacture drift. Anything else — a changed word, a
removed line — is drift.

## Why drift is never repaired automatically

Because the edit might have been intentional, and because Syngraphe cannot tell the difference
between "somebody adjusted the wording" and "a merge mangled it". Overwriting would silently
discard a decision somebody made.

So `check` reports `AGENT002` (or `CLAUDE002`) and `init` refuses to write anything until the
conflict is resolved. Two ways to resolve it:

- delete the whole block and re-run `init`, which reinstates the canonical text; or
- restore the expected content by hand.

If you want different wording for agents, put it **outside** the markers. Text outside the block is
never touched and never triggers drift.

## Why no hashes are stored

An earlier design stored a content hash of the block in the repository so drift could be detected
without comparing text. It was dropped: the expected content is already known to the tool, so the
comparison needs no stored state, and a hash in a tracked file is noise in every diff that touches
the block.

Nothing about a managed block is recorded outside the file that contains it.

## Using the subsystem directly

Block manipulation is a generic, pure part of the package — it knows nothing about `AGENTS.md`,
Claude, or any agent:

```ts
import {
  findManagedBlock,
  insertManagedBlock,
  removeManagedBlock,
  replaceManagedBlock,
  validateManagedBlock,
} from "syngraphe";

const patched = insertManagedBlock(original, body);
validateManagedBlock(patched, body).status; // "valid"
removeManagedBlock(patched) === original;   // true
```

Every function is a pure string transformation, which is why the guarantees above can be tested
exhaustively rather than sampled.
