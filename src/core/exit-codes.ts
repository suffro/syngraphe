/**
 * Stable process exit codes.
 *
 * These are part of the CLI contract: scripts and CI depend on them, so values
 * must not be reused or renumbered.
 */
export const EXIT_SUCCESS = 0;
export const EXIT_INTEGRITY_FAILURE = 1;
export const EXIT_USAGE = 2;
export const EXIT_UNSUPPORTED_SCHEMA = 3;
export const EXIT_INTERNAL = 4;

export type ExitCode =
  | typeof EXIT_SUCCESS
  | typeof EXIT_INTEGRITY_FAILURE
  | typeof EXIT_USAGE
  | typeof EXIT_UNSUPPORTED_SCHEMA
  | typeof EXIT_INTERNAL;
