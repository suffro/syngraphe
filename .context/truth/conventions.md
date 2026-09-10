# Conventions

## Repository conventions

- TypeScript, ESM, modern Node LTS (>= 22.18). Node built-ins are preferred over dependencies;
  `commander` is the only CLI runtime dependency. `@actions/core`, `esbuild` and `yaml` are
  development dependencies for the separately bundled GitHub Action.
- Relative imports carry the `.ts` extension: `tsc` rewrites them on build, and Node's type
  stripping runs the same sources directly in tests.
- Comments explain non-obvious decisions and rejected alternatives, not what the code already says.
- English for code, comments, documentation and user-facing output.

## Development workflow

```bash
npm install
npm run build      # tsc -p tsconfig.build.json → dist/
npm test           # node --test over test/**/*.test.ts
npm run typecheck  # tsc --noEmit over src/ and test/
npm run lint       # biome check .
npm run format     # biome format --write .
npm run action:build # rebuild the committed Action and third-party notices
npm run action:check # fail on bundle/source drift without writing
npm run test:action  # adapter and standalone bundle tests

npm run docs:dev   # VitePress dev server for docs/
npm run docs:build # build the documentation site
```

Integration tests create real temporary Git repositories under the system temporary directory and
remove them afterwards. They never touch the developer's own repository.

## Important rules

- Adding an agent integration: one adapter in `src/agents/integrations/`, one line in the registry,
  tests. No agent-specific branching anywhere else.
- Adding a check: one module in `src/checks/`, one line in the registry, tests, a new stable code,
  and a row in the README table.
- Finding codes and exit codes are never renumbered or reused.
- Templates in `src/templates/` are the expected content checks compare against: changing them
  changes what every repository is validated against.
- Any command that modifies the repository builds a plan first; inspection and writing never happen
  in the same function.
- Root bootstrap content stays frozen; nested bootstraps use their own canonical body.
- Scope paths use forward slashes and are Git-root-relative; filenames created by document commands
  use portable ASCII stems, without automatic dates or decision numbering.
- New guards get a test that observes them failing, not only passing.

- Any change to shared `src/` or `action/src/` must keep the committed Action bundle synchronized.
  Never hand-edit generated bundle files. The LF rule in `.gitattributes` keeps bundle verification
  portable. Preserve generated third-party notices with the bundle.
- Action documentation lives in `docs/reference/github-action.md`; `action/README.md` points there.
  Do not invent release tags or claim Marketplace availability before an actual release.
