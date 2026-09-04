/**
 * Read-only inspection of `.context/`.
 *
 * Inspection never writes and never guesses: it reports what is on disk so
 * that planning (init) and reporting (status, check) can decide separately.
 */

import type { Repository } from "../core/repository.ts";
import {
  CONTEXT_DIRECTORY,
  CONTEXT_ENTRIES,
  CONTEXT_SCHEMA_VERSION,
  DECISIONS_DIRECTORY,
  HISTORY_DIRECTORY,
  MANIFEST_PATH,
  REQUIRED_CONTEXT_FILES,
} from "../templates/context.ts";

export type ContextStatus =
  /** No `.context/` at all. */
  | "absent"
  /** Supported schema and every expected file present. */
  | "valid"
  /** Recognisably Syngraphe, but incomplete. */
  | "partial"
  /** A manifest declaring a schema this build does not support. */
  | "unsupported-schema"
  /** A manifest that is not valid JSON or has an unusable shape. */
  | "invalid-manifest"
  /** A `.context` path that is not a Syngraphe context directory. */
  | "unrelated";

export interface ManifestInspection {
  present: boolean;
  parsed: boolean;
  schemaVersion: number | null;
  layout: string | null;
  parseError: string | null;
}

export interface ContextInspection {
  status: ContextStatus;
  /** Why the directory was classified as unrelated, when it was. */
  conflictReason: string | null;
  manifest: ManifestInspection;
  presentFiles: string[];
  missingFiles: string[];
  decisionCount: number;
  historyCount: number;
}

export async function inspectContext(repository: Repository): Promise<ContextInspection> {
  const kind = await repository.kind(CONTEXT_DIRECTORY);

  if (kind === "missing") {
    return emptyInspection("absent", null);
  }
  if (kind !== "directory") {
    return emptyInspection(
      "unrelated",
      `${CONTEXT_DIRECTORY} exists but is not a directory (${kind}).`,
    );
  }

  const manifest = await inspectManifest(repository);
  const presentFiles: string[] = [];
  const missingFiles: string[] = [];
  for (const file of REQUIRED_CONTEXT_FILES) {
    if ((await repository.kind(file)) === "file") presentFiles.push(file);
    else missingFiles.push(file);
  }

  const decisionCount = await countDocuments(repository, DECISIONS_DIRECTORY);
  const historyCount = await countDocuments(repository, HISTORY_DIRECTORY);

  const base = {
    conflictReason: null,
    manifest,
    presentFiles,
    missingFiles,
    decisionCount,
    historyCount,
  };

  if (!manifest.present) {
    const entries = (await repository.list(CONTEXT_DIRECTORY)) ?? [];
    const meaningful = entries.filter((entry) => entry !== ".DS_Store");
    if (meaningful.length === 0) {
      return { ...base, status: "partial" };
    }
    const looksLikeSyngraphe = meaningful.some((entry) => CONTEXT_ENTRIES.includes(entry));
    if (!looksLikeSyngraphe) {
      return {
        ...base,
        status: "unrelated",
        conflictReason: `${CONTEXT_DIRECTORY}/ exists, has no ${MANIFEST_PATH}, and contains unrelated entries: ${meaningful.join(", ")}.`,
      };
    }
    return { ...base, status: "partial" };
  }

  if (!manifest.parsed) return { ...base, status: "invalid-manifest" };
  if (manifest.schemaVersion === null) return { ...base, status: "invalid-manifest" };
  if (manifest.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
    return { ...base, status: "unsupported-schema" };
  }
  return { ...base, status: missingFiles.length === 0 ? "valid" : "partial" };
}

async function inspectManifest(repository: Repository): Promise<ManifestInspection> {
  const raw = await repository.read(MANIFEST_PATH);
  if (raw === null) {
    return { present: false, parsed: false, schemaVersion: null, layout: null, parseError: null };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return {
      present: true,
      parsed: false,
      schemaVersion: null,
      layout: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      present: true,
      parsed: false,
      schemaVersion: null,
      layout: null,
      parseError: "Manifest must be a JSON object.",
    };
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = typeof record.schemaVersion === "number" ? record.schemaVersion : null;
  const layout = typeof record.layout === "string" ? record.layout : null;
  return { present: true, parsed: true, schemaVersion, layout, parseError: null };
}

async function countDocuments(repository: Repository, directory: string): Promise<number> {
  const entries = await repository.list(directory);
  if (entries === null) return 0;
  return entries.filter((entry) => entry.endsWith(".md") && entry !== "README.md").length;
}

function emptyInspection(status: ContextStatus, conflictReason: string | null): ContextInspection {
  return {
    status,
    conflictReason,
    manifest: {
      present: false,
      parsed: false,
      schemaVersion: null,
      layout: null,
      parseError: null,
    },
    presentFiles: [],
    missingFiles: [...REQUIRED_CONTEXT_FILES],
    decisionCount: 0,
    historyCount: 0,
  };
}
