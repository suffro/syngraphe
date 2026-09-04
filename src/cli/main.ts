/**
 * CLI entry point.
 *
 * The CLI layer stays thin on purpose: it parses arguments, opens the
 * repository, delegates to a command, and turns errors into stable exit codes.
 * No domain logic lives here.
 */

import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { runCheck } from "../commands/check.ts";
import { runInit } from "../commands/init.ts";
import { runStatus } from "../commands/status.ts";
import { SyngrapheError } from "../core/errors.ts";
import { EXIT_INTERNAL, EXIT_SUCCESS, EXIT_USAGE, type ExitCode } from "../core/exit-codes.ts";
import { Repository } from "../core/repository.ts";
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
      const repository = await Repository.open(cwd);
      exitCode = await runInit({ repository, output, dryRun: commandOptions.dryRun });
    });

  program
    .command("status")
    .description("Summarize the repository context. Read-only and offline.")
    .action(async () => {
      const repository = await Repository.open(cwd);
      exitCode = await runStatus({ repository, output });
    });

  program
    .command("check")
    .description("Run the deterministic context integrity checks.")
    .option("--json", "Emit machine-readable findings.", false)
    .option("--strict", "Fail on warnings as well as errors.", false)
    .action(async (commandOptions: { json: boolean; strict: boolean }) => {
      const repository = await Repository.open(cwd);
      exitCode = await runCheck({
        repository,
        output,
        json: commandOptions.json,
        strict: commandOptions.strict,
      });
    });

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
