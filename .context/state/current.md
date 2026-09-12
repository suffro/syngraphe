# Current State

## Current focus

Syngraphe implements initialization, integrity checks, statistics and document lifecycle helpers,
with explicit package scopes for nested/monorepo context. A bundled GitHub Action now adds
runner annotations, summaries and versioned reports on top of the same core. Schema v1, the root managed block and
single-scope check JSON remain unchanged. The Action is released as `action-v1.0.0`, with `action-v1` for compatible updates.
These tags are independent of the npm CLI; package release metadata has not been changed.

## Recent relevant changes

- `create` operations are now exclusive at the filesystem level. The apply preflight could not keep
  two concurrent runs from creating the same missing path, because `Repository.write` published
  every operation with a rename: both passed the `missing` check and the second rename replaced the
  first file. `applyPlan` now publishes creates through `Repository.create`, which links the staged
  file into place and reports the destination taken instead of replacing it. Updates keep their
  stale-content check and rename. `test/plan.test.ts` holds the invariant with a barrier that puts
  concurrent applies in the race window deliberately; the tests were observed failing against the
  rename-based publish.
- Previous statistics/document/monorepo work was committed and pushed to `origin/main` as
  `e7a5bf50d9a4be72cd751fba4ec5bb91e58acb96`; the remote hash was read back successfully.
- Root `action.yml` provides `check`, `stats`, and `check-and-stats`, checkout/scope selection,
  monorepo discovery, strict and report-only validation, and an optional per-scope budget gate.
- Action reports are stored under runner temp, with bounded summaries and escaped file/line
  annotations. The bundle runs standalone; no npm install, API token or target-code execution.
- The new CI matrix targets Linux, macOS and Windows, with the local Action before dependency
  installation, metadata/runtime tests, and deterministic bundle/third-party-notice checks.
  GitHub release `action-v1.0.0` and compatibility tag `action-v1` both resolve to
  `9b86b8b8109d8f58c81782c466cb9774d1cb6367`. The public release was verified through GitHub's API.
  Marketplace publication remains pending: GitHub documents the release-editor checkbox, with no
  corresponding option in the public release API or `gh release`; Computer Use is unavailable
  and the user prefers terminal operations. See `decisions/0005-bundled-github-action.md`.

- `stats` reports bytes, words, estimated tokens, active/history totals, large Markdown documents
  and exact duplicates; its token budget is advisory and JSON is independently versioned.
- `decision`, `state`, `history` support `new` and `list`. `state archive` preserves current state in
  a new history file then resets the state template, with dry-run and preflight safety checks.
- `--scope` selects an existing directory relative to Git root. `--all` on read-only reports
  discovers tracked/unignored contexts. Nested agent bootstraps explain ancestor context and scope
  selection; default root behavior is preserved. See `decisions/0004-explicit-scopes-and-context-tools.md`.
- Documentation now covers the document lifecycle, stats JSON and explicit monorepo discovery.
- Latest local verification on macOS with Node 24: all 130 tests passed (15 Action tests), including
  standalone bundle execution and report/annotation behavior. Typecheck, lint, CLI/Action builds,
  documentation build, package dry-run inspection and repository `check --all` passed.
  The bundle drift guard was observed rejecting an intentionally changed artifact, then passing
  after restoration. Hosted CI run `34542006024` passed on Ubuntu, macOS and Windows at the release commit:
  130 tests passed with no skips on each OS, plus standalone Action execution, bundle verification,
  typecheck, lint and build. The first run exposed Windows checkout CRLF conversion; repository
  text now uses LF via `.gitattributes`, also verified with `core.autocrlf=true` locally.

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
- The search-result icon was Google's own choice, not the site's: with only `/static/icon.ico`
  declared and `/favicon.ico` returning the 404 page, Google had cached the bare mark — a
  transparent, full-bleed glyph its round crop cut into, and nearly invisible on a dark results
  page. The icon now ships at `/favicon.ico` (16/32/48 rendered from the logo, the original 256
  entry carried over byte-for-byte) plus 96/192 PNGs and a 180 `apple-touch-icon`, all the same
  opaque square. Nothing in markup selects a search-result logo; the favicon is that logo, so the
  fix is the file and the declaration. The JSON-LD graph gained an `Organization` with a `logo`,
  which feeds knowledge panels rather than the result icon.
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

- Complete Marketplace publication in the GitHub release editor for `action-v1.0.0`, then verify
  the public listing. Release URL: https://github.com/suffro/syngraphe/releases/tag/action-v1.0.0

- After the icon change is deployed, request indexing of the home page in Search Console so the
  cached favicon is refreshed; Google documents that this can take days to weeks.
- Confirm the `syngraphe.dev` domain and Pages project before announcing the docs URL.
- Use the tool on real repositories and collect friction before adding surface.
- Candidates for later versions, none of them started: `doctor`, `update`, `reconcile`, and an
  explicit destructive removal command with a confirmation phrase.

## Blockers

None.
