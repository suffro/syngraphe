import { EXIT_INTERNAL, type ExitCode } from "./exit-codes.ts";

/**
 * An error that carries the exit code the CLI should terminate with.
 *
 * Anything thrown that is not a SyngrapheError is treated as an internal
 * failure, because it was not anticipated by the command that raised it.
 */
export class SyngrapheError extends Error {
  readonly exitCode: ExitCode;
  readonly details: string | undefined;

  constructor(message: string, exitCode: ExitCode = EXIT_INTERNAL, details?: string) {
    super(message);
    this.name = "SyngrapheError";
    this.exitCode = exitCode;
    this.details = details;
  }
}
