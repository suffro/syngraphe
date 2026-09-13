# Write surface hardening plan

## Current focus

A repository scan found a correct but unprotected `--dry-run` guarantee, a residual TOCTOU race in
patch publication, possible byte corruption of non-UTF-8 files patched by `init`, and five minor
issues. Goal: close all of them with small fixes, tests observed failing before each fix, and
documentation that promises exactly what the code guarantees.

Approved plan, not started. Suggested order: 2 → 1 → 3 → 4–7 → 8 → 9. Each item can be committed
on its own.

## Recent relevant changes

None yet for this plan. The create race was already closed (see `current.md`).

## Next

### 1. Patch TOCTOU race (highest priority)

`applyPlan()` in `src/core/plan.ts` compares `before` in the preflight, then publishes with
`repository.write()` → `writeTextFileAtomic` (blind rename). An edit between the comparison and the
rename is lost; this matters most for `state archive`, which resets `state/current.md`.

Fix: put the verification in the publish step, as for creates. New primitive in `src/core/fs.ts`,
`replaceTextFileIfUnchanged(absolutePath, expected: Buffer, contents): Promise<boolean>`:

1. Stage the new contents with `stageTextFile()`.
2. `rename(dest, aside)` to `.syngraphe-<hex>.aside` in the same directory, moving the compared
   inode away atomically.
3. Read `aside` and compare bytes with `expected`. On mismatch, restore with `link(aside, dest)`
   (on `EEXIST`, keep `aside` and fail naming its path) and return false.
4. `link(staged, dest)`. On `EEXIST` the file was recreated concurrently: keep `aside`, fail
   explicitly, return false.
5. Unlink `aside` and the staged file in `finally`.

- No-hard-link fallback: same flow with `writeFile(..., { flag: "wx" })`, as in
  `createTextFileExclusive`.
- Windows: renaming a file open elsewhere fails (`EPERM`/`EBUSY`); fail closed with an integrity
  error, never retry blindly.
- Residual to document: a process writing through a file descriptor already open on the original
  inode after step 3. Node cannot close that window.

Wiring: `Repository.replace(relativePath, expected, contents)` with `assertWritablePath`; `applyPlan`
uses it and throws the existing "changed since the plan was built" error (`EXIT_INTEGRITY_FAILURE`)
on false. Remove `Repository.write()` if nothing else uses it. Update the `applyPlan` header comment.

Tests (`test/plan.test.ts`, `test/repository.test.ts`): an edit injected between preflight and
publish through a seam like `linkFile` → concurrent content preserved, integrity error, no `.tmp` or
`.aside` left; the no-hard-link path; observed failing against `writeTextFileAtomic`.

### 2. `init` can corrupt non-UTF-8 bytes in AGENTS.md / CLAUDE.md

`readTextFile()` decodes with `toString("utf8")`, which substitutes U+FFFD. `inspectManagedFile` in
`src/managed/file.ts` builds the patch from that string, so "preserved byte for byte" is false.

Fix: generalise the round-trip check already in `planDocument` (`src/commands/documents.ts`).

- Add `decodeUtf8Exact(bytes): string | null` in `src/core/fs.ts`; reuse it in `planDocument`.
- `inspectManagedFile` reads bytes; a failed round-trip becomes a `conflict` ("must be valid UTF-8
  to patch without changing its bytes"), so nothing is written.
- Rule: every existing file that ends up in a `patch` goes through `decodeUtf8Exact`. Audit the
  patch producers: `planManagedFile`, `planDocument` (archive), `src/agents/integrations/`.
- Add a test showing a UTF-8 BOM survives.

Tests (`test/init.test.ts`): AGENTS.md containing `0xFF` → `init` and `init --dry-run` report a
conflict with integrity failure; the file is byte-identical afterwards.

### 3. `--dry-run` invariant protected by types and tests

Wording: replace "side-effect free" / "without modifying any file" with the defensible guarantee:
"`--dry-run` runs the same planner as the real command and performs no repository mutations: it does
not modify repository contents or Git state." Places: `--dry-run` help in `src/cli/main.ts`,
`README.md`, `docs/concepts/safety-model.md`, `docs/reference/cli.md`, `docs/.vitepress/llms.mjs`.
The "No files were modified." output can stay.

Type: `ReadOnlyRepository` in `src/core/repository.ts` exposing `root`, `gitRoot`, `scope`, `git`,
`resolve`, `relativize`, `kind`, `size`, `read`, `readBytes`, `realPath`, `list` and the validation-only
`assertWritablePath`; no `write`, `create`, `replace` or `makeDirectory`. `Repository implements` it.
Narrow every inspection/planning signature to it: `planInitialization`, `planDocument`,
`listDocuments`, `inspectContext`, `requireContext`, `inspectManagedFile`, `inspectAgentsBootstrap`,
`AgentIntegration` methods (`src/agents/types.ts`), the check context (`src/checks/types.ts`), stats
inspectors. Only `applyPlan` and the `run*` functions receive `Repository`.

- `GitClient` (`src/core/git.ts`) already exposes reads only; add a comment forbidding mutating Git
  commands there.
- Export the type from `src/index.ts`; widening parameters is compatible.
- Prove the guard can fail: a temporary `repository.write()` inside a planner must fail `tsc`
  (manual, not committed).

Shared test `test/dry-run.test.ts` over every mutating command (`init`, `init --scope`,
`truth|decision|state|history new`, `state archive`, each with and without `--json`):

- working tree via the existing `TempRepo.snapshot()` (`test/helpers/repo.ts`);
- new `gitSnapshot()` helper: hashes of `HEAD`, `index`, `refs/`, `packed-refs`, `config`, plus
  `git status --porcelain=v2`, `git rev-parse HEAD`, `git count-objects -v`;
- no `.syngraphe-*` file anywhere.

Use a dirty repository (untracked file and staged change) so the index comparison means something.

### 4. `status` counts non-file entries

`countDocuments` in `src/inspectors/context.ts` filters by name only, and its `README.md` exclusion
is case-sensitive. Share one rule with `listDocuments` (`isDocumentEntry(name)` plus
`kind === "file"`). Tests (`test/status.test.ts`): a symlink and a directory with a Markdown
extension, and a lowercase-variant readme, are not counted. Update the note in `docs/reference/cli.md`.

### 5. `referenceExists()` accepts final symlinks

In `src/core/scopes.ts` a reference only needs `kind !== "missing"`. Accept a symlink (final or
intermediate) only when its real path exists and stays inside the real Git root; broken or escaping
links report `LINK001`. Tests (`test/check.test.ts`): internal link passes, outside link and broken
link fail. Document it in `docs/reference/checks.md`.

### 6. Exclusive-create fallback wording

The code comment is accurate; public wording is stronger than the guarantee. In `README.md`,
`docs/concepts/architecture.md` and the "Writes are complete or absent" section of
`docs/concepts/safety-model.md`, state that without hard links a create stays exclusive but a crash
can leave the new file partial. Optional: unlink the partial file when the fallback `writeFile` fails
after creating it.

### 7. Manifest-less `.context/` identification is too permissive

`inspectShape` treats `.context/` as not foreign if any single layout name is present (for example
only `truth/`). Without a manifest, or with one lacking `protocol`, report `partial` only when every
known entry has the expected kind and at least one template file is a regular file (`index.md` or a
`REQUIRED_CONTEXT_FILES` entry); unknown entries or wrong kinds are `unrelated`. An empty directory
stays not foreign. Tests: lone `truth/` (empty or with unrelated files) is `unrelated`; `index.md` plus
`truth/architecture.md` is `partial`. Update `docs/guides/adopting-an-existing-repository.md` and the
identity section of `docs/concepts/safety-model.md`. Visible behaviour change: changelog entry.

### 8. Where planning documents belong

No new category is needed. An in-progress plan lives in `state/` (`syngraphe state new`, linked from
`state/current.md`), a finished or abandoned one moves to `history/`, and resulting choices go to
`decisions/`. Add this example to `docs/concepts/context-model.md` and
`docs/guides/writing-the-context.md`. The two in-progress plans previously filed under `history/`
have already been moved to `state/`.

### 9. Documentation and repository context

- `.context/truth/architecture.md` and `docs/concepts/architecture.md`: `ReadOnlyRepository`,
  verification inside patch publication, exact UTF-8 rule for patches.
- `.context/state/current.md`: progress on this plan; move this document to `history/` when done.
- New decision record `0006`: patch verification lives in the publish step, with the open-descriptor
  residual.
- Changelog entries for items 2, 4, 5 and 7 per the existing release process.
- `npm run action:build` and `npm run action:check`, since `src/` is bundled into the Action.

### Verification

1. Focused tests per item, each observed failing before its fix.
2. Full suite, typecheck, lint and format (commands from `package.json`).
3. `npm run action:build && npm run action:check` with no drift in `action/dist/`.
4. Docs build for changed pages and `test/docs-markdown.test.ts`.
5. Manual: temporary repository with `0xFF` in AGENTS.md → `syngraphe init` refuses and `cmp` shows
   no change; `syngraphe state archive x --dry-run` leaves `git status` and the `.git/index` hash
   unchanged.
6. `syngraphe check` on this repository.
7. Not verifiable on macOS: Windows rename semantics and the FAT/network-share fallback. CI matrix
   and the `linkFile` seam cover them; say so in the PR.

## Blockers

None.
