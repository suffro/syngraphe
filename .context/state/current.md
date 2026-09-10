# Current State

## Current focus

Syngraphe implements initialization, integrity checks, statistics and document lifecycle helpers,
with explicit package scopes for nested/monorepo context. Schema v1, the root managed block and
single-scope check JSON remain unchanged. The new features are implemented but not released; package release metadata has not been changed.

## Recent relevant changes

- `stats` reports bytes, words, estimated tokens, active/history totals, large Markdown documents
  and exact duplicates; its token budget is advisory and JSON is independently versioned.
- `decision`, `state`, `history` support `new` and `list`. `state archive` preserves current state in
  a new history file then resets the state template, with dry-run and preflight safety checks.
- `--scope` selects an existing directory relative to Git root. `--all` on read-only reports
  discovers tracked/unignored contexts. Nested agent bootstraps explain ancestor context and scope
  selection; default root behavior is preserved. See `decisions/0004-explicit-scopes-and-context-tools.md`.
- Documentation now covers the document lifecycle, stats JSON and explicit monorepo discovery.
- Local verification on macOS: 115 tests passed; typecheck, lint, CLI build, documentation build,
  package dry-run inspection and repository `check --all` passed. Linux and Windows were not run
  locally; scope resolution normalizes Git root separators and document names reject Windows devices.

- Initial implementation of the package, CLI, core, managed blocks, integrations and checks.
- Test suite covering managed-block behaviour, path safety, initialization (idempotency,
  preservation, dry-run parity) and every check.
- README documenting scope, safety properties, finding codes and exit codes.
- The CLI is installed under two command names: `syngraphe` (canonical, used in all documentation and
  in the managed block) and the shorthand `syg`.
- Documentation site in `docs/` (VitePress): getting started, guides, reference and concepts, with a
  monochrome theme built from the two logo colours. Deployed as a Cloudflare Pages project rooted at
  `docs/`; the production hostname is declared once in `docs/.vitepress/config.mts`.
- The managed block's second line now says to keep the context accurate in the same change, without
  a "significant changes" threshold. Changing it again after publication would report drift in every
  initialized repository.
- The reference check distinguishes prose from pointers, after the archived brief under `history/`
  produced six false `LINK001` findings. See `decisions/0002-inline-code-references-are-prose.md`.
- The docs site publishes a Markdown surface for agents: `llms.txt`, `llms-full.txt`, a `.md` twin
  per page, `Accept: text/markdown` negotiation through a Cloudflare Pages Function, per-page
  Markdown and "Ask an AI" menus, and a `robots.txt` that names the assistant crawlers explicitly.
- The docs distinguish generated content from illustration explicitly. Every block that is invented
  prose carries an `ExampleNote` label above it, outside the fence; blocks that are real output or
  real generated files are labelled too. The quickstart was the page where this mattered most: its
  filled-in `truth/architecture.md` read as something `init` writes, which it never does.
- The quickstart now offers two routes in a `Tabs` group — Quick (no `--dry-run`) and Guided — plus
  a "What `init` writes" section listing all nine files. Its terminal transcripts were re-captured
  from real runs rather than edited by hand.
- The manifest declares `"protocol": "repository-context"`, added to schema v1 rather than to a v2.
  It is what identifies a `.context/` directory, so the generic name can stay generic; a manifest
  naming another protocol is `unrelated`, and a manifest with no `protocol` falls back to the shape
  test and reports `MANIFEST005`. See `decisions/0003-the-manifest-declares-the-protocol.md`.

## Next

- Confirm the `syngraphe.dev` domain and Pages project before announcing the docs URL.
- Use the tool on real repositories and collect friction before adding surface.
- Candidates for later versions, none of them started: `doctor`, `update`, `reconcile`, and an
  explicit destructive removal command with a confirmation phrase.

## Blockers

None.
