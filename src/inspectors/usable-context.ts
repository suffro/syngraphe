import { SyngrapheError } from "../core/errors.ts";
import { EXIT_INTEGRITY_FAILURE, EXIT_UNSUPPORTED_SCHEMA } from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";
import { REQUIRED_CONTEXT_FILES } from "../templates/context.ts";
import { inspectContext } from "./context.ts";

/** Document operations and statistics require an initialized, supported context. */
export async function requireContext(repository: Repository): Promise<void> {
  if ((await repository.kind(".context")) === "directory") {
    for (const file of REQUIRED_CONTEXT_FILES) await repository.assertWritablePath(file);
  }
  const context = await inspectContext(repository);
  if (context.status === "valid") return;
  throw new SyngrapheError(
    `Context is ${context.status} in scope ${repository.scope}.`,
    context.status === "unsupported-schema" ? EXIT_UNSUPPORTED_SCHEMA : EXIT_INTEGRITY_FAILURE,
    context.status === "absent" || context.status === "partial"
      ? "Run syngraphe init for this scope first."
      : "Resolve the context classification before continuing.",
  );
}
