# Current State

## Current focus

Syngraphe v0.1 is implemented: `init` (with `--dry-run`), `status`, and `check` (with `--json` and
`--strict`), the schema v1 context templates, the managed-block subsystem, the agent-integration
registry (Claude shim, Cursor and Codex native), and the deterministic check registry.

## Recent relevant changes

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

## Next

- Confirm the `syngraphe.dev` domain and Pages project before announcing the docs URL.
- Use the tool on real repositories and collect friction before adding surface.
- Candidates for later versions, none of them started: `doctor`, `update`, `reconcile`, and an
  explicit destructive removal command with a confirmation phrase.

## Blockers

None.
