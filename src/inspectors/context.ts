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
  CONTEXT_PROTOCOL,
  CONTEXT_SCHEMA_VERSION,
  DECISIONS_DIRECTORY,
  HISTORY_DIRECTORY,
  MANIFEST_FILE,
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
  /** The declared protocol, or null when the manifest does not name one. */
  protocol: string | null;
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

  const shape = await inspectShape(repository);

  if (!manifest.present) {
    if (shape.foreign) {
      return {
        ...base,
        status: "unrelated",
        conflictReason: `${CONTEXT_DIRECTORY}/ exists, has no ${MANIFEST_PATH}, and contains unrelated entries: ${shape.entries.join(", ")}.`,
      };
    }
    return { ...base, status: "partial" };
  }

  if (!manifest.parsed) return { ...base, status: "invalid-manifest" };

  // Identity before version: a manifest naming another protocol is someone
  // else's directory, and reporting its schema as unsupported would tell the
  // user to upgrade Syngraphe over a file Syngraphe must not read at all.
  if (manifest.protocol !== null && manifest.protocol !== CONTEXT_PROTOCOL) {
    return {
      ...base,
      status: "unrelated",
      conflictReason: `${MANIFEST_PATH} declares protocol "${manifest.protocol}", not "${CONTEXT_PROTOCOL}".`,
    };
  }
  // Without the marker there is nothing to identify the manifest by, so the
  // weaker shape test decides — as it does when there is no manifest at all.
  if (manifest.protocol === null && shape.foreign) {
    return {
      ...base,
      status: "unrelated",
      conflictReason: `${MANIFEST_PATH} does not declare "protocol": "${CONTEXT_PROTOCOL}", and ${CONTEXT_DIRECTORY}/ contains unrelated entries: ${shape.entries.join(", ")}.`,
    };
  }

  if (manifest.schemaVersion === null) return { ...base, status: "invalid-manifest" };
  if (manifest.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
    return { ...base, status: "unsupported-schema" };
  }
  return { ...base, status: missingFiles.length === 0 ? "valid" : "partial" };
}

interface ShapeInspection {
  /** Directory entries other than the manifest and editor leftovers. */
  entries: string[];
  /** Entries exist and none of them belongs to the standard layout. */
  foreign: boolean;
}

/**
 * The shape-based identity test, used only where the manifest cannot answer.
 *
 * `manifest.json` is excluded: any tool may write one, so its presence says
 * nothing about who wrote it — which is the question being asked. An empty
 * directory is not evidence of another tool either, so it is not foreign.
 */
async function inspectShape(repository: Repository): Promise<ShapeInspection> {
  const listed = (await repository.list(CONTEXT_DIRECTORY)) ?? [];
  const entries = listed.filter((entry) => entry !== ".DS_Store" && entry !== MANIFEST_FILE);
  return {
    entries,
    foreign: entries.length > 0 && !entries.some((entry) => CONTEXT_ENTRIES.includes(entry)),
  };
}

async function inspectManifest(repository: Repository): Promise<ManifestInspection> {
  const raw = await repository.read(MANIFEST_PATH);
  if (raw === null) {
    return {
      present: false,
      parsed: false,
      protocol: null,
      schemaVersion: null,
      layout: null,
      parseError: null,
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return {
      present: true,
      parsed: false,
      protocol: null,
      schemaVersion: null,
      layout: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      present: true,
      parsed: false,
      protocol: null,
      schemaVersion: null,
      layout: null,
      parseError: "Manifest must be a JSON object.",
    };
  }

  const record = value as Record<string, unknown>;
  const protocol = typeof record.protocol === "string" ? record.protocol : null;
  const schemaVersion = typeof record.schemaVersion === "number" ? record.schemaVersion : null;
  const layout = typeof record.layout === "string" ? record.layout : null;
  return { present: true, parsed: true, protocol, schemaVersion, layout, parseError: null };
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
      protocol: null,
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
