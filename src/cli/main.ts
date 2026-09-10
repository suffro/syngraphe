/**
 * CLI entry point.
 *
 * The CLI layer stays thin on purpose: it parses arguments, opens the
 * repository, delegates to a command, and turns errors into stable exit codes.
 * No domain logic lives here.
 */

import { readFileSync } from "node:fs";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { runCheck } from "../commands/check.ts";
import { listDocuments, runDocument } from "../commands/documents.ts";
import { runInit } from "../commands/init.ts";
import { runAcrossScopes } from "../commands/scopes.ts";
import { runStats } from "../commands/stats.ts";
import { runStatus } from "../commands/status.ts";
import { SyngrapheError } from "../core/errors.ts";
import { EXIT_INTERNAL, EXIT_SUCCESS, EXIT_USAGE, type ExitCode } from "../core/exit-codes.ts";
import { selectRepositories, selectRepository } from "../core/scopes.ts";
import { DEFAULT_TOKEN_BUDGET } from "../inspectors/stats.ts";
import type { DocumentCategory } from "../templates/documents.ts";
import { consoleOutput, type Output } from "./output.ts";

export interface MainOptions {
  output?: Output;
  cwd?: string;
}

export async function main(argv: string[], options: MainOptions = {}): Promise<ExitCode> {
  const output = options.output ?? consoleOutput;
  const cwd = options.cwd ?? process.cwd();

  const program = new Command();
  let exitCode: ExitCode = EXIT_SUCCESS;

  program
    .name("syngraphe")
    .description(
      "Keeps repository context versioned, current, and understandable by both humans and coding agents.",
    )
    .option("--scope <path>", "Select an existing directory relative to the Git root.")
    .version(readVersion(), "-v, --version")
    .exitOverride()
    .configureOutput({
      writeOut: (text) => output.write(text),
      writeErr: (text) => output.writeError(text),
    })
    .showHelpAfterError();

  program
    .command("init")
    .description("Create the repository context and the agent bootstrap files.")
    .option("--dry-run", "Show the plan without modifying any file.", false)
    .action(async (commandOptions: { dryRun: boolean }) => {
      const repository = await selectRepository(cwd, program.opts().scope);
      exitCode = await runInit({ repository, output, dryRun: commandOptions.dryRun });
    });

  for (const name of ["status", "check", "stats"] as const) {
    const command = program
      .command(name)
      .description(
        {
          status: "Summarize repository context.",
          check: "Run context integrity checks.",
          stats: "Report context size, estimated tokens and bloat signals.",
        }[name],
      )
      .option("--all", "Report every discovered context in the Git repository.", false);
    if (name !== "status") command.option("--json", "Emit a versioned JSON report.", false);
    if (name === "check") command.option("--strict", "Fail on warnings as well as errors.", false);
    if (name === "stats")
      command.option(
        "--budget <tokens>",
        "Advisory total Markdown token budget.",
        positiveInteger,
        DEFAULT_TOKEN_BUDGET,
      );
    command.action(
      async (commandOptions: {
        all: boolean;
        json?: boolean;
        strict?: boolean;
        budget?: number;
      }) => {
        const repositories = await selectRepositories(cwd, {
          ...program.opts(),
          all: commandOptions.all,
        });
        exitCode = await runAcrossScopes({
          repositories,
          all: commandOptions.all,
          json: commandOptions.json ?? false,
          output,
          run: (repository, sink) => {
            if (name === "status") return runStatus({ repository, output: sink });
            if (name === "stats")
              return runStats({
                repository,
                output: sink,
                json: commandOptions.json ?? false,
                budget: commandOptions.budget,
              });
            return runCheck({
              repository,
              output: sink,
              json: commandOptions.json ?? false,
              strict: commandOptions.strict ?? false,
            });
          },
        });
      },
    );
  }

  for (const category of ["decision", "state", "history"] satisfies DocumentCategory[]) {
    const group = program.command(category).description(`Create and list ${category} documents.`);
    group
      .command("new <name>")
      .description("Create a Markdown document without overwriting existing files.")
      .option("--title <title>", "Document heading (defaults to the filename with spaces).")
      .option("--dry-run", "Show the plan without writing.", false)
      .action(async (name: string, commandOptions: { title?: string; dryRun: boolean }) => {
        const repository = await selectRepository(cwd, program.opts().scope);
        exitCode = await runDocument({
          repository,
          output,
          category,
          name,
          ...commandOptions,
        });
      });
    group
      .command("list")
      .description("List Markdown documents in filename order, excluding README.md.")
      .action(async () => {
        const repository = await selectRepository(cwd, program.opts().scope);
        const files = await listDocuments(repository, category);
        output.write(files.length ? files.join("\n") : "No documents found.");
      });
    if (category === "state") {
      group
        .command("archive <name>")
        .description("Preserve current state in history and reset current.md to its template.")
        .option("--dry-run", "Show the plan without writing.", false)
        .action(async (name: string, commandOptions: { dryRun: boolean }) => {
          const repository = await selectRepository(cwd, program.opts().scope);
          exitCode = await runDocument({
            repository,
            output,
            category: "history",
            name,
            archive: true,
            ...commandOptions,
          });
        });
    }
  }

  try {
    await program.parseAsync(argv, { from: "user" });
    return exitCode;
  } catch (error) {
    return handleError(error, output);
  }
}

function handleError(error: unknown, output: Output): ExitCode {
  if (error instanceof CommanderError) {
    // Help and version are successful outcomes; everything else is misuse.
    return error.exitCode === 0 ? EXIT_SUCCESS : EXIT_USAGE;
  }

  if (error instanceof SyngrapheError) {
    output.writeError(error.message);
    if (error.details) output.writeError(error.details);
    return error.exitCode;
  }

  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  output.writeError("Internal Syngraphe failure.");
  output.writeError(message);
  return EXIT_INTERNAL;
}

function readVersion(): string {
  try {
    const manifest = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    const parsed: unknown = JSON.parse(manifest);
    if (typeof parsed === "object" && parsed !== null) {
      const version = (parsed as { version?: unknown }).version;
      if (typeof version === "string") return version;
    }
  } catch {
    // Fall through: a missing package.json must not break the CLI.
  }
  return "0.0.0";
}

function positiveInteger(value: string): number {
  const number = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) {
    throw new InvalidArgumentError("Expected a positive safe integer.");
  }
  return number;
}
