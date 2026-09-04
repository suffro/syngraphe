# Inline-code references are prose, not pointers

## Decision

The reference check treats inline code differently from Markdown links.

- A Markdown link is a pointer: it is checked whatever it points at, resolved relative to the
  document as Markdown requires.
- Inline code is prose: only a `.md` reference is checked, and it may resolve relative to the
  document, from the repository root, or from `.context/`.

A directory named in inline code — `.cursor/rules/`, `src/` — is not a reference at all, and neither
is a bare extension written as `` `.md` ``.

## Why

Both halves came from real `LINK001` findings on this repository's own context, after an archived
brief was added under `history/`.

The archived document referred to `truth/architecture.md` the way every context document does — the
way `index.md` itself does — but from `history/` neither the document-relative nor the root-relative
candidate existed, so a correct reference was reported broken. Resolving from the context root as
well is what makes the same name mean the same file in every context document, which is the whole
point of naming siblings that way.

The same document mentioned `.cursor/rules/` as a hypothetical in a specification. Checking
directories quoted in prose catches almost nothing real: a missing context directory is already
reported by the structure check, because its `README.md` is one of the required files. What it does
catch is every directory a document merely talks about.

Overclaiming is the failure mode this check has to avoid. A finding that fires on correct prose
teaches people to stop reading findings.

## Rejected alternatives

- **Editing the archived brief to use root-relative paths.** It would have made this repository green
  while leaving the defect in the tool for everyone who archives a note under `history/`.
- **A suppression file or per-check ignore.** Real for a later version, but a configuration knob is
  the wrong answer to a check that is simply wrong here.
- **Dropping inline-code references from the check entirely.** They are how context documents
  actually name each other; the generated `index.md` uses nothing else.
