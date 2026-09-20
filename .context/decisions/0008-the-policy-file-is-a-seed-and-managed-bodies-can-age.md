# The policy file is a seed, and managed bodies are allowed to age

## Decision

`AGENT-POLICY.md` is written at the Git root by `syngraphe init --policy` and `syngraphe policy add`,
and is never managed afterwards: no markers, no expected content, no check. An existing one is a
conflict that stops the command; `--force` replaces it through a normal `patch`, which still compares
the exact bytes it replaces. A file differing only by case is a conflict on every platform. The
command refuses `--scope`: one policy governs the repository.

`AGENTS.md` references it with one line inside the managed block, written unconditionally and phrased
as a condition (`If AGENT-POLICY.md is present, read it ...`).

Changing that body made every already-initialized repository report `AGENT002`. So
`validateManagedBlock` now takes the bodies Syngraphe published earlier and returns `outdated`
instead of `drift` when the block matches one of them exactly. `check` reports `AGENT006` as a
warning and `init` replaces the body in place. `SUPERSEDED_AGENTS_BODIES` is append-only.

## Why

Three alternatives were rejected.

**A body derived from the file's presence.** Expected content computed from the filesystem means
creating or deleting `AGENT-POLICY.md` turns an untouched block into drift — a failure nobody caused,
on a path the tool refuses to repair. One constant body keeps the block a single comparable contract,
in the same shape the `syngraphe check` line already had.

**A reference outside the markers.** It avoids the migration entirely but puts Syngraphe in the
business of writing user-owned prose it then never tracks, and leaves a dangling reference when the
policy file is deleted.

**Bumping `MANAGED_BLOCK_VERSION`.** A block whose marker declares an unknown version is
`unsupported-version`, which is a conflict. Bumping would be worse than the drift it was meant to
avoid.

The `outdated` state is the general answer, not a one-off: the canonical text will change again.
Rewriting is safe there and only there, because the body matched byte for byte something Syngraphe
itself wrote, so no decision of anybody's is discarded. That is the whole distinction from drift, and
it is why superseded bodies are never removed from the list — dropping one turns every repository
still carrying it into an unrepairable drift report.

## Why the policy is a seed, at the root

The repository must stay usable without Syngraphe, and a policy is prose people rewrite. Managing it
would mean either overwriting their edits or reporting drift on a document that is supposed to
diverge.

It sits at the Git root, not in `.context/`, because `.context/` holds facts about the repository
while this is an instruction to the agent — the same category as `AGENTS.md` and `CLAUDE.md`, which
are already at the root. It also keeps a hundred lines that are not context out of the size and token
estimates `stats` reports.

It stays out of `AGENTS.md` because that file is loaded in every session: process rules that matter
for multi-step or risky work should not be paid for on every one-line task.

## Why there is no prompt

The original request was to ask in the terminal before overwriting. The CLI has no interactive
surface at all — it inspects, plans, renders and applies, and the same entry points run under
`--dry-run`, `--json`, CI and the bundled Action. A prompt would have to be suppressed in all of them
and would still need a flag for non-interactive use, so the flag is the whole design. The default
without it is the existing idiom: refuse, explain, exit non-zero.
