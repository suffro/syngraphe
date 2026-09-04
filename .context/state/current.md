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

## Next

- Confirm the `syngraphe.dev` domain and Pages project before announcing the docs URL.
- Use the tool on real repositories and collect friction before adding surface.
- Candidates for later versions, none of them started: `doctor`, `update`, `reconcile`, and an
  explicit destructive removal command with a confirmation phrase.

## Blockers

None.
