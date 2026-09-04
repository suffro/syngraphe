import { CONTEXT_DIRECTORY } from "../templates/context.ts";
import type { Check, Finding } from "./types.ts";

/** `.context/` exists, belongs to Syngraphe, and contains the expected files. */
export const structureCheck: Check = {
  id: "context-structure",
  label: "context structure",
  category: "structure",

  async run(context) {
    const findings: Finding[] = [];
    const inspection = context.context;

    if (inspection.status === "absent") {
      findings.push({
        code: "CTX001",
        severity: "error",
        category: "structure",
        file: `${CONTEXT_DIRECTORY}/`,
        message: "Repository context is not initialized.",
        details: "Run `syngraphe init` to create the repository context.",
      });
      return findings;
    }

    if (inspection.status === "unrelated") {
      findings.push({
        code: "CTX003",
        severity: "error",
        category: "structure",
        file: `${CONTEXT_DIRECTORY}/`,
        message: `${CONTEXT_DIRECTORY}/ is not a Syngraphe repository context.`,
        details: inspection.conflictReason ?? undefined,
      });
      return findings;
    }

    for (const file of inspection.missingFiles) {
      findings.push({
        code: "CTX002",
        severity: "error",
        category: "structure",
        file,
        message: "Expected context file is missing.",
        details: "Run `syngraphe init` to create the missing context files.",
      });
    }

    return findings;
  },
};
