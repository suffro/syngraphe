import { createCapturedOutput, type Output } from "../cli/output.ts";
import { SyngrapheError } from "../core/errors.ts";
import { EXIT_SUCCESS, EXIT_UNSUPPORTED_SCHEMA, type ExitCode } from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";

/** Keep single-scope command contracts intact; --all has its own explicit envelope. */
export async function runAcrossScopes(options: {
  repositories: Repository[];
  all: boolean;
  json: boolean;
  output: Output;
  run: (repository: Repository, output: Output) => Promise<ExitCode>;
}): Promise<ExitCode> {
  if (!options.all) {
    const repository = options.repositories[0];
    if (!repository) throw new Error("No repository selected.");
    return options.run(repository, options.output);
  }
  const scopes: { scope: string; result: unknown }[] = [];
  let exitCode: ExitCode = EXIT_SUCCESS;
  for (const repository of options.repositories) {
    const captured = createCapturedOutput();
    let code: ExitCode;
    let failure: { error: string; exitCode: ExitCode } | undefined;
    try {
      code = await options.run(repository, captured);
    } catch (error) {
      if (!(error instanceof SyngrapheError)) throw error;
      code = error.exitCode;
      failure = { error: error.message, exitCode: code };
      captured.write(error.message);
    }
    if (code === EXIT_UNSUPPORTED_SCHEMA || exitCode === EXIT_SUCCESS) exitCode = code;
    if (captured.stderr) options.output.writeError(captured.stderr);
    if (options.json)
      scopes.push({ scope: repository.scope, result: failure ?? JSON.parse(captured.stdout) });
    else options.output.write(`Scope: ${repository.scope}\n${captured.stdout}`);
  }
  if (options.json)
    options.output.write(
      JSON.stringify({ version: 1, ok: exitCode === EXIT_SUCCESS, scopes }, null, 2),
    );
  return exitCode;
}
