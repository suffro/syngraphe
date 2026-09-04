<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand-assets/svg/logo-dark.svg">
    <img src="brand-assets/svg/logo-light.svg" alt="Syngraphe" width="320">
  </picture>
</p>

# Syngraphe

Syngraphe keeps repository context versioned, current, and understandable by both humans and coding
agents.

It is a small, Git-native command-line tool that creates and validates a `.context/` directory of
Markdown documents describing what a repository is, how it is built, and what is happening in it
right now.

**Documentation: [syngraphe.dev](https://syngraphe.dev)** — guides, CLI reference, finding codes and
the reasoning behind the design. The site's source is in [`docs/`](docs/).

## Why context belongs in the repository

Project knowledge usually lives everywhere except where the code is: in chat threads, in tickets, in
one person's head, in a vendor's cloud memory. It drifts, it is invisible in review, and it
disappears when the tool that stored it does.

Syngraphe takes the opposite position:

- **The context belongs to the repository, not to Syngraphe.** It is committed, reviewed and
  branched with the code it describes.
- **Git provides history and versioning.** There is no separate database and no separate timeline.
- **Markdown is the format.** Anyone can read and edit the context with a text editor.
- **Humans and coding agents read the same documents.** `AGENTS.md` points agents at `.context/`;
  people open the same files.
- **The repository stays usable without Syngraphe.** If the executable disappears, `.context/`,
  `AGENTS.md`, Markdown and Git history remain complete and meaningful. Syngraphe implements the
  repository-context protocol; the protocol does not depend on Syngraphe.

The deterministic core works offline and without AI. Optional AI support may come later; it will
never be required.

## Install

Requires Node.js 22.18 or newer and Git on the `PATH`.

```bash
npm install -g syngraphe
```

Or run it without installing:

```bash
npx syngraphe status
```

The CLI is installed under two interchangeable names: `syngraphe` and the shorthand `syg`. The
documentation uses the full name.

## Usage

```bash
syngraphe init            # create the repository context and agent bootstrap
syngraphe init --dry-run  # show exactly what would change, write nothing

syngraphe status          # summarize the repository context

syngraphe check           # run the deterministic integrity checks
syngraphe check --json    # machine-readable findings, for CI
syngraphe check --strict  # treat warnings as failures
```

### What `init` creates

```text
.context/
├── manifest.json          # schema version and layout
├── index.md               # router into the context
├── truth/
│   ├── architecture.md    # current system architecture
│   └── conventions.md     # repository conventions
├── state/
│   └── current.md         # current focus, recent changes, next steps, blockers
├── decisions/
│   └── README.md          # significant technical decisions, one file each
└── history/
    └── README.md          # completed or superseded operational context
```

It also adds a managed block to `AGENTS.md`, creating the file if needed, and a `CLAUDE.md` that
imports `AGENTS.md` — created if absent, or extended with the import block only if it already
exists. A `CLAUDE.md` that already imports `AGENTS.md`, or that is a symlink to it, is left alone.

The templates are deliberately small. They are starting points for humans to fill in, not
questionnaires.

### Context lifecycle

| Directory    | Lifecycle | Contents                                                            |
| ------------ | --------- | ------------------------------------------------------------------- |
| `truth/`     | stable    | architecture, conventions, domain concepts, constraints, invariants |
| `state/`     | volatile  | current focus, recent relevant changes, next steps, blockers        |
| `decisions/` | append    | significant technical and architectural decisions, with rationale   |
| `history/`   | archive   | completed or superseded operational context, kept out of the way    |

## Safety

Syngraphe edits files people also edit by hand, so it is conservative by construction:

- It owns only the text between its own markers:

  ```md
  <!-- syngraphe:start version="1" -->
  <!-- Managed by Syngraphe. Do not edit this block manually. -->
  ...
  <!-- syngraphe:end -->
  ```

- Everything outside those markers is user-owned and is preserved byte for byte, including line
  endings and a missing final newline.
- A managed block edited by hand is reported as drift, never silently overwritten.
- Duplicate or malformed blocks are reported, never guessed at.
- Initialization is idempotent: running it twice changes nothing the second time.
- Every modifying command builds a plan, renders it, and applies exactly that plan. `--dry-run` uses
  the same plan and stops before writing.
- Writes are complete-file writes via a temporary file and a rename, so an interrupted run cannot
  leave a half-written file.
- Syngraphe never writes outside the Git root and never writes through a symlink.
- An existing `.context/` that is not a Syngraphe context is never touched: the command aborts and
  explains the conflict.

## Checks

`syngraphe check` runs deterministic, offline checks. Codes are stable.

| Code                      | Severity | Meaning                                                       |
| ------------------------- | -------- | ------------------------------------------------------------- |
| `CTX001`                  | error    | repository context is not initialized                         |
| `CTX002`                  | error    | an expected context file is missing                           |
| `CTX003`                  | error    | `.context/` exists but is not a Syngraphe context             |
| `MANIFEST001`             | error    | `.context/manifest.json` is missing                           |
| `MANIFEST002`             | error    | manifest is not valid JSON, or has no `schemaVersion`         |
| `MANIFEST003`             | error    | manifest declares an unsupported schema version               |
| `MANIFEST004`             | warning  | manifest declares an unknown layout                           |
| `AGENT001`                | error    | `AGENTS.md` has no Syngraphe block                            |
| `AGENT002`                | error    | the `AGENTS.md` block was modified manually                   |
| `AGENT003`                | error    | `AGENTS.md` contains duplicate Syngraphe blocks               |
| `AGENT004`                | error    | `AGENTS.md` markers are unbalanced                            |
| `AGENT005`                | error    | `AGENTS.md` cannot be managed safely                          |
| `CLAUDE001`               | warning  | Claude is used but `CLAUDE.md` has no import of `AGENTS.md`   |
| `CLAUDE002` – `CLAUDE004` | error    | the `CLAUDE.md` block drifted, is duplicated, or is malformed |
| `CLAUDE005`               | warning  | `CLAUDE.md` is a setup Syngraphe deliberately leaves alone    |
| `LINK001`                 | error    | a context document references a path that does not exist      |
| `STATE001`                | warning  | `state/current.md` has not changed while the repository did   |
| `STATE002`                | warning  | `state/current.md` contains only headings                     |

Freshness is treated as a signal, not a verdict: `STATE001` is a warning, it is only raised when the
repository has commits newer than the state document, and it says the age rather than declaring the
context stale.

### Exit codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | success                              |
| `1`  | context integrity failure            |
| `2`  | invalid CLI usage                    |
| `3`  | unsupported Syngraphe context schema |
| `4`  | internal Syngraphe failure           |

By default errors fail a command and warnings are reported only. With `--strict`, warnings fail it
too.

### JSON output

```json
{
  "version": 1,
  "ok": false,
  "findings": [
    {
      "code": "LINK001",
      "severity": "error",
      "category": "references",
      "file": ".context/index.md",
      "line": 12,
      "message": "Referenced path does not exist: truth/gone.md"
    }
  ]
}
```

`version` describes the payload shape and changes only when the shape does.

## Agent integrations

`AGENTS.md` is the canonical bootstrap file. Agents that read it need nothing else:

| Agent  | Integration                                       |
| ------ | ------------------------------------------------- |
| Claude | `CLAUDE.md` importing `AGENTS.md` (a thin shim)   |
| Cursor | native — reads `AGENTS.md`                        |
| Codex  | native — reads `AGENTS.md`                        |

Vendor-specific configuration such as `.cursor/rules/` is detected for reporting and otherwise left
untouched.

## Scope of v0.1

Implemented:

- `syngraphe init`, `syngraphe init --dry-run`
- `syngraphe status`
- `syngraphe check`, `--json`, `--strict`
- the `.context/` schema v1 and its templates
- managed blocks in `AGENTS.md` and `CLAUDE.md`
- the deterministic check registry

## Non-goals

Syngraphe manages shared repository context and its integrity. It is not a rule transpiler and does
not synchronize hooks, permissions, MCP configuration, subagents, skills, or vendor-specific
commands. Vendor features stay vendor-specific.

Not implemented yet, by design: semantic AI analysis, `doctor`, `update`, `reconcile`, MCP servers,
vector databases, cloud services, direct AI provider integrations, GitHub Actions, Git hooks and
background services.

Destructive removal is also not implemented. When it arrives it will be an explicit command — never
called `uninstall` — that shows exactly what it would remove, preserves user-authored content
outside managed blocks, treats `.context/` as potentially valuable human-authored data, and requires
an explicit confirmation phrase.

## Development

```bash
npm install
npm run build      # compile to dist/
npm test           # node:test suites, including real temporary Git repositories
npm run typecheck  # tsc --noEmit over src/ and test/
npm run lint       # Biome
```

The source layout follows the dependency direction `cli → commands → core → filesystem/Git`. Agent
integrations (`src/agents/`) and checks (`src/checks/`) are registries consumed by commands, so
adding either is a new module plus one registration plus tests.

## License

Apache-2.0. See [LICENSE](LICENSE).
