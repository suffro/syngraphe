Implement a HOL Guard command extension for Syngraphe.

Work in the current `hashgraph-online/hol-guard` repository and follow its existing command-extension architecture and contribution rules. Use `command_repo2nb_extensions.py` as the closest structural example, but do not copy semantics that do not fit Syngraphe.

Authoritative Syngraphe references:

GitHub:
https://github.com/suffro/syngraphe

Docs:
https://syngraphe.dev/

The extension must be solid an remain entirely Guard-side. Do not modify the Syngraphe repository or introduce any dependency from Syngraphe to HOL Guard.

Create the extension in the expected runtime module:

    src/codex_plugin_scanner/guard/runtime/command_syngraphe_extensions.py

and add focused tests in:

    tests/test_guard_command_syngraphe_extensions.py

Register it through the normal HOL Guard extension/catalog mechanisms and update generated extension documentation/catalog files if required by the repository.

==================================================
SUPPORTED EXECUTABLES
==================================================

Syngraphe has two equivalent CLI executable names:

    syngraphe
    syg

Both must receive identical treatment.

Do not accidentally protect only the canonical name.

Do not duplicate the code for both CLI executable names, always mantain one source of truth.

Inspect the current HOL Guard launcher/wrapper matcher conventions and support the normal command invocation shapes expected by Guard, including wrappers/compound shell forms where existing extension infrastructure already handles them.

Do not invent unsupported Syngraphe syntax.

==================================================
POLICY MODEL
==================================================

The core boundary is:

1. Commands that only inspect repository context stay automatic.
2. Commands that mutate shared repository context require review.
3. A verified `--dry-run` of a mutating command stays automatic because Syngraphe guarantees it uses the same planner and performs no writes.
4. `--json` on mutating commands is only valid together with `--dry-run`, so `--dry-run --json` must remain automatic.
5. `--scope <path>` changes the target scope but not the safety classification.

The extension should detect facts and provide evidence. Guard retains final policy authority. Do not make the extension directly approve commands.

==================================================
COMPLETE SYNGAPHE CLI COVERAGE
==================================================

Cover the complete current CLI surface, not only a few examples.

Always automatic / read-only:

    syngraphe -v
    syngraphe --version
    syg -v
    syg --version

    syngraphe -h
    syngraphe --help
    syg -h
    syg --help

and help variants for commands/subcommands, for example:

    syngraphe init --help
    syngraphe check --help
    syngraphe decision new --help
    syngraphe state archive --help

Read-only commands must stay automatic with every valid flag combination:

    status
    status --all

    check
    check --all
    check --json
    check --strict
    check --all --json
    check --all --strict
    check --all --json --strict

    stats
    stats --all
    stats --json
    stats --budget <tokens>
    stats *with all valid combinations of:* --all, --json and --budget

Document listing:

    truth list
    decision list
    state list
    history list

All of the above also remain automatic when used with a valid:

    --scope <path>

where Syngraphe permits it.

==================================================
MUTATING COMMANDS
==================================================

Require review for real execution of:

    init

    truth new <name>
    decision new <name>
    state new <name>
    history new <name>

    state archive <name>

This remains true with normal mutating-command options such as:

    --title <title>
    --scope <path>

Examples that require review:

    syngraphe init

    syngraphe truth new domain-model
    syngraphe truth new domain-model --title "Domain model"

    syg decision new use-postgres
    syg decision new use-postgres --title "Use PostgreSQL"

    syngraphe --scope packages/api state new migration
    syngraphe state new migration --scope packages/api

    syngraphe state archive phase-one
    syngraphe state archive phase-one --scope packages/api

==================================================
SAFE DRY-RUN VARIANTS
==================================================

Every mutating command has a side-effect-free `--dry-run`.

These must stay automatic:

    init --dry-run
    init --dry-run --json

    truth new <name> --dry-run
    truth new <name> --dry-run --json

    decision new <name> --dry-run
    decision new <name> --dry-run --json

    state new <name> --dry-run
    state new <name> --dry-run --json

    history new <name> --dry-run
    history new <name> --dry-run --json

    state archive <name> --dry-run
    state archive <name> --dry-run --json

Support valid flag reordering rather than depending on one exact textual spelling, for example:

    syngraphe decision new foo --dry-run --json
    syngraphe decision new foo --json --dry-run
    syngraphe --scope packages/api decision new foo --dry-run
    syngraphe decision new foo --scope packages/api --dry-run

`--title` values and `--scope` values must be parsed as option values and must not confuse the matcher.

Do not treat `--json` alone as the safe condition. The safety predicate is specifically the verified presence of `--dry-run`.

==================================================
MATCHING REQUIREMENTS
==================================================

Use HOL Guard's canonical parsed-command model and existing structured matchers.

Do not:

- reparse raw shell text;
- build a parallel parser;
- use a broad regex when a structured matcher works;
- persist command arguments, paths, titles, document names, or repository content;
- weaken another Guard rule.

Handle both `syngraphe` and `syg`.

Test realistic command composition:

- direct execution;
- quoted arguments;
- option ordering;
- global `--scope`;
- shell separators / compound commands where applicable;
- existing supported wrapper forms;
- suffix commands;
- malformed or uncertain input.

A safe variant must only make the Syngraphe rule safe. It must not suppress another matching Guard rule in the same compound command.

For example, something conceptually like:

    syngraphe decision new foo --dry-run && rm -rf something

must not become globally safe merely because the Syngraphe segment is a dry-run.

Fail securely on parsing uncertainty according to existing HOL Guard conventions.

==================================================
RULE DESIGN
==================================================

Prefer a small coherent Syngraphe extension, e.g. a stable ID in the normal form:

    command.syngraphe

Use the smallest sensible rule set.

A reasonable grouping is:

- initialization mutation
- document creation mutation
- state archive mutation

Do not create one rule per harmless read-only command unless the Guard architecture genuinely requires it.

The important invariant is that read-only commands do not reach review, while actual repository-context mutations do.

Use existing HOL Guard risk/action class vocabulary where appropriate. Do not invent a new risk taxonomy if an existing compatible class fits.

Descriptions should accurately reflect Syngraphe semantics:

- `init` creates `.context/` and may create or patch agent bootstrap files;
- `truth/decision/state/history new` create persistent shared repository-context Markdown;
- `state archive` creates a history document and resets `.context/state/current.md`;
- these operations are review-worthy because they mutate shared repository context that future humans and coding agents may consume.

Do not describe normal Syngraphe operations as destructive if they are not destructive.

Useful safer alternative for every mutating rule:

    Run the same command with --dry-run first to inspect the exact plan without modifying files.

==================================================
TEST MATRIX
==================================================

Add focused table-driven tests.

At minimum prove:

1. Both executable aliases:
   - `syngraphe`
   - `syg`

2. Version/help stay automatic:
   - `-v`
   - `--version`
   - `-h`
   - `--help`
   - command/subcommand help

3. All read-only families stay automatic:
   - status
   - check
   - stats
   - truth list
   - decision list
   - state list
   - history list

4. Valid flag combinations on read-only commands stay automatic:
   - --all
   - --json
   - --strict
   - --budget
   - --scope
   - combinations thereof where Syngraphe permits them

5. Real mutations reach review:
   - init
   - truth new
   - decision new
   - state new
   - history new
   - state archive

6. `--title` and `--scope` do not bypass review.

7. Every mutating command with `--dry-run` stays automatic.

8. Every mutating command with `--dry-run --json` stays automatic.

9. `--json` without `--dry-run` must not be mistaken for the safe variant.

10. Reordered options retain the same classification.

11. Compound commands preserve evidence from all segments and a Syngraphe dry-run cannot suppress another dangerous command.

12. Evidence/catalog data does not persist document names, titles, paths, command text, or other user data.

Use the existing command-extension contract assertions and registry/directory tests required by HOL Guard.

==================================================
DOCUMENTATION / CATALOG
==================================================

Add the extension metadata and generated directory/catalog entry required by the current HOL Guard contribution process.

Reference the official Syngraphe project:

    https://github.com/suffro/syngraphe
    https://syngraphe.dev/

Keep the description factual and concise.

Do not claim that HOL Guard is required by Syngraphe or that Syngraphe officially depends on HOL Guard.

==================================================
VALIDATION
==================================================

Run the focused Syngraphe extension tests first, then all extension registry/directory checks required by the current contribution guide.

At minimum use the current equivalents of:

    uv run pytest -q tests/test_guard_command_syngraphe_extensions.py
    uv run pytest -q tests/test_guard_command_extension_registry.py tests/test_guard_command_extension_directory.py
    uv run python scripts/render_command_extension_directory.py --check
    uv run ruff check <changed files>
    uv run ruff format --check <changed files>

Then run any broader test suite required by CONTRIBUTING.md for this change.

Regenerate generated catalog/directory files when required and verify they are clean afterwards.

Do not weaken existing tests.

==================================================
FINAL OUTPUT
==================================================

When finished, report:

1. the extension/rule IDs added;
2. the exact classification matrix implemented;
3. supported executable aliases;
4. safe `--dry-run` behavior;
5. files changed;
6. tests added;
7. validation commands and results;
8. any ambiguous CLI case that needs my review.

Do not merge anything.

If repository contribution rules permit it and all validation passes, prepare/open the requested draft PR against:

    hashgraph-online/hol-guard:main

with a concise description that this is optional Guard-side coverage for Syngraphe.