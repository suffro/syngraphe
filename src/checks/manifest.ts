import {
  CONTEXT_LAYOUT,
  CONTEXT_PROTOCOL,
  CONTEXT_SCHEMA_VERSION,
  MANIFEST_PATH,
} from "../templates/context.ts";
import type { Check, Finding } from "./types.ts";

/** The manifest exists, parses, and declares a schema this build supports. */
export const manifestCheck: Check = {
  id: "manifest",
  label: "manifest",
  category: "manifest",

  async run(context) {
    const findings: Finding[] = [];
    const inspection = context.context;

    // An absent or unrelated `.context/` is reported by the structure check;
    // repeating it here would only add noise.
    if (inspection.status === "absent" || inspection.status === "unrelated") return findings;

    const { manifest } = inspection;

    if (!manifest.present) {
      findings.push({
        code: "MANIFEST001",
        severity: "error",
        category: "manifest",
        file: MANIFEST_PATH,
        message: "Context manifest is missing.",
        details: "Run `syngraphe init` to complete the repository context.",
      });
      return findings;
    }

    if (!manifest.parsed) {
      findings.push({
        code: "MANIFEST002",
        severity: "error",
        category: "manifest",
        file: MANIFEST_PATH,
        message: "Context manifest is not valid JSON.",
        details: manifest.parseError ?? undefined,
      });
      return findings;
    }

    // A manifest naming another protocol never reaches here: the directory is
    // classified as unrelated, and the structure check reports it as CTX003.
    if (manifest.protocol === null) {
      findings.push({
        code: "MANIFEST005",
        severity: "warning",
        category: "manifest",
        file: MANIFEST_PATH,
        message: "Context manifest does not declare a protocol.",
        details: `Add \`"protocol": "${CONTEXT_PROTOCOL}"\` to the manifest. Without it, a \`.context/\` directory can only be recognised by its shape.`,
      });
    }

    if (manifest.schemaVersion === null) {
      findings.push({
        code: "MANIFEST002",
        severity: "error",
        category: "manifest",
        file: MANIFEST_PATH,
        message: "Context manifest has no numeric `schemaVersion`.",
      });
      return findings;
    }

    if (manifest.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
      findings.push({
        code: "MANIFEST003",
        severity: "error",
        category: "manifest",
        file: MANIFEST_PATH,
        message: `Unsupported context schema version ${manifest.schemaVersion}.`,
        details: `This Syngraphe build supports schema version ${CONTEXT_SCHEMA_VERSION}.`,
      });
      return findings;
    }

    if (manifest.layout !== CONTEXT_LAYOUT) {
      findings.push({
        code: "MANIFEST004",
        severity: "warning",
        category: "manifest",
        file: MANIFEST_PATH,
        message: `Unknown context layout ${manifest.layout === null ? "(missing)" : `"${manifest.layout}"`}.`,
        details: `This Syngraphe build knows the "${CONTEXT_LAYOUT}" layout only.`,
      });
    }

    return findings;
  },
};
