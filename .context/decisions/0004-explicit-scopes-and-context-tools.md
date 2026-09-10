# Explicit scopes and context tools

## Decision

Keep Git-root selection as the default. `--scope` selects an existing Git-root-relative directory
for every command, with its own schema v1 `.context` and local agent bootstrap. `--all` on reporting
commands discovers contexts from tracked and unignored Git files. Contexts are independent; shared
knowledge remains in ancestor context and can be linked explicitly. No schema migration is needed.

Root bootstrap content and single-scope check JSON remain unchanged. The scoped bootstrap tells
readers to consult ancestor context and select the local scope for checks. It embeds no absolute
paths or shell commands containing user-controlled path strings, so moving a package does not
introduce bootstrap drift. All-scope JSON uses a separate versioned envelope.

Document helpers create portable named Markdown files with headings only. They impose no numbering,
dates, decision-status workflow or automatic index edits. `state archive` preserves the current
UTF-8 text in history before resetting the current-state template through a precondition-checked
create/patch plan. It does not claim a multi-file filesystem transaction.

Statistics count regular files recursively within one context. Markdown tokens are the sum of
ceil(UTF-8 bytes/4) per file, a reproducible heuristic rather than a tokenizer or actual prompt size.
History and active content are separate; total budget, large documents and exact duplicates are
advisory, without new integrity finding codes.

## Rationale and alternatives

- Implicit nearest-context lookup would silently change existing CLI behavior in subdirectories.
  Explicit scopes keep CI commands and programmatic callers predictable.
- Package-manager workspace manifests would add ecosystem dependencies. Git enumeration covers
  tracked and unignored content without scanning ignored dependency trees or following symlinks.
  Empty/ignored nested contexts require explicit selection; separate Git roots are separate runs.
- Merging contexts or resolving conflicting prose would invent semantics beyond Markdown. The
  bootstrap describes shared/local reading responsibility while each scope stays independently usable.
- Automatic numbering, dates or document routing would create metadata and editorial decisions the
  author did not supply. Plain files and optional titles are enough for the requested lifecycle.
- Model-specific tokenization would add dependencies and still not describe what each agent loads.
  A documented estimate gives repeatable size comparisons with no network or model dependency.
