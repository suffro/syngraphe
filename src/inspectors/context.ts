/**
 * Read-only inspection of `.context/`.
 *
 * Inspection never writes and never guesses: it reports what is on disk so
 * that planning (init) and reporting (status, check) can decide separately.
 */

import type { PathKind } from "../core/fs.ts";
import type { ReadOnlyRepository } from "../core/repository.ts";
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

export async function inspectContext(repository: ReadOnlyRepository): Promise<ContextInspection> {
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

  const decisionCount = (await listDocumentFiles(repository, DECISIONS_DIRECTORY)).length;
  const historyCount = (await listDocumentFiles(repository, HISTORY_DIRECTORY)).length;

  const base = {
    conflictReason: null,
    manifest,
    presentFiles,
    missingFiles,
    decisionCount,
    historyCount,
  };

  const shapeProblem = await inspectShape(repository, presentFiles);

  if (!manifest.present) {
    if (shapeProblem !== null) {
      return {
        ...base,
        status: "unrelated",
        conflictReason: `${CONTEXT_DIRECTORY}/ exists, has no ${MANIFEST_PATH}, and ${shapeProblem}.`,
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
  if (manifest.protocol === null && shapeProblem !== null) {
    return {
      ...base,
      status: "unrelated",
      conflictReason: `${MANIFEST_PATH} does not declare "protocol": "${CONTEXT_PROTOCOL}", and ${CONTEXT_DIRECTORY}/ ${shapeProblem}.`,
    };
  }

  if (manifest.schemaVersion === null) return { ...base, status: "invalid-manifest" };
  if (manifest.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
    return { ...base, status: "unsupported-schema" };
  }
  return { ...base, status: missingFiles.length === 0 ? "valid" : "partial" };
}

/**
 * Regular Markdown documents directly inside `directory`, in filename order.
 *
 * One rule serves both `status` counts and `<category> list`: a symlink or a
 * directory named like a document is not a document, and a README describes
 * its directory whatever its letter case.
 */
export async function listDocumentFiles(
  repository: ReadOnlyRepository,
  directory: string,
): Promise<string[]> {
  if ((await repository.kind(directory)) !== "directory") return [];
  const files: string[] = [];
  for (const entry of (await repository.list(directory)) ?? []) {
    if (!entry.endsWith(".md") || entry.toLowerCase() === "readme.md") continue;
    const file = `${directory}/${entry}`;
    if ((await repository.kind(file)) === "file") files.push(file);
  }
  return files;
}

/**
 * The shape-based identity test, used only where the manifest cannot answer.
 *
 * Returns why the directory does not look like a repository context, or null
 * when it does. One familiar name is weak evidence — `truth/` or `index.md` is
 * an ordinary name another tool may use — so the whole top level has to be the
 * standard layout, each entry of its standard kind, with at least one standard
 * document present as a regular file.
 *
 * `manifest.json` is excluded: any tool may write one, so its presence says
 * nothing about who wrote it — which is the question being asked. An empty
 * directory is not evidence of another tool either, so it is not foreign.
 */
async function inspectShape(
  repository: ReadOnlyRepository,
  presentFiles: string[],
): Promise<string | null> {
  const listed = (await repository.list(CONTEXT_DIRECTORY)) ?? [];
  const entries = listed.filter((entry) => entry !== ".DS_Store" && entry !== MANIFEST_FILE);
  if (entries.length === 0) return null;

  const unknown = entries.filter((entry) => !CONTEXT_ENTRIES.includes(entry));
  if (unknown.length > 0) return `contains unrelated entries: ${unknown.join(", ")}`;

  const wrongKind: string[] = [];
  for (const entry of entries) {
    // Apart from the manifest, the standard top level is `index.md` and directories.
    const expected: PathKind = entry.endsWith(".md") ? "file" : "directory";
    const kind = await repository.kind(`${CONTEXT_DIRECTORY}/${entry}`);
    if (kind !== expected) wrongKind.push(`${entry} (${kind})`);
  }
  if (wrongKind.length > 0) {
    return `contains standard names of the wrong kind: ${wrongKind.join(", ")}`;
  }

  if (!presentFiles.some((file) => file !== MANIFEST_PATH)) {
    return "contains no standard context document";
  }
  return null;
}

async function inspectManifest(repository: ReadOnlyRepository): Promise<ManifestInspection> {
  const kind = await repository.kind(MANIFEST_PATH);
  if (kind !== "file" && kind !== "missing") {
    return {
      present: true,
      parsed: false,
      protocol: null,
      schemaVersion: null,
      layout: null,
      parseError: `${MANIFEST_PATH} must be a regular file, found ${kind}.`,
    };
  }
  const raw = kind === "missing" ? null : await repository.read(MANIFEST_PATH);
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
