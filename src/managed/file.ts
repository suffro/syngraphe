/**
 * Managed blocks applied to real files.
 *
 * This is the bridge between the pure block operations and the plan/apply
 * core. It knows nothing about which agent a file belongs to: callers pass the
 * path, the expected body and a description of the change.
 */

import type { PathKind } from "../core/fs.ts";
import type { Plan } from "../core/plan.ts";
import { emptyPlan } from "../core/plan.ts";
import type { Repository } from "../core/repository.ts";
import {
  insertManagedBlock,
  type ManagedBlockState,
  renderManagedBlock,
  validateManagedBlock,
} from "./block.ts";

export type ManagedFileStatus =
  | "ready"
  | "missing"
  | "drift"
  | "duplicate"
  | "malformed"
  | "conflict";

export interface ManagedFileState {
  path: string;
  kind: PathKind;
  content: string | null;
  status: ManagedFileStatus;
  block: ManagedBlockState | null;
  message: string | null;
  details: string | null;
}

/** Read a file and classify its managed block against the expected body. */
export async function inspectManagedFile(
  repository: Repository,
  path: string,
  expectedBody: string,
): Promise<ManagedFileState> {
  const kind = await repository.kind(path);

  if (kind === "missing") {
    return state(path, kind, null, "missing", null, `${path} does not exist.`, null);
  }
  if (kind !== "file") {
    // Symlinks included: Syngraphe never writes through a link, so a caller
    // that wants to accept one has to recognise it before asking for a plan.
    return state(
      path,
      kind,
      null,
      "conflict",
      null,
      `${path} exists but is not a regular file (${kind}).`,
      null,
    );
  }

  const content = await repository.read(path);
  if (content === null) {
    return state(path, kind, null, "conflict", null, `${path} could not be read.`, null);
  }

  const block = validateManagedBlock(content, expectedBody);
  switch (block.status) {
    case "absent":
      return state(path, kind, content, "missing", block, `${path} has no Syngraphe block.`, null);
    case "valid":
      return state(path, kind, content, "ready", block, null, null);
    case "drift":
      return state(
        path,
        kind,
        content,
        "drift",
        block,
        `The Syngraphe block in ${path} was modified manually.`,
        "Syngraphe will not overwrite it. Restore the expected content or remove the block and re-run initialization.",
      );
    case "unsupported-version":
      return state(
        path,
        kind,
        content,
        "conflict",
        block,
        `The Syngraphe block in ${path} declares version "${block.block.version ?? "none"}".`,
        "This Syngraphe build only manages version 1 blocks.",
      );
    case "duplicate":
      return state(
        path,
        kind,
        content,
        "duplicate",
        block,
        `${path} contains ${block.blocks.length} Syngraphe blocks.`,
        "Keep exactly one and re-run.",
      );
    case "malformed":
      return state(
        path,
        kind,
        content,
        "malformed",
        block,
        block.reason === "unterminated"
          ? `${path} has a Syngraphe start marker without an end marker (line ${block.line}).`
          : `${path} has a Syngraphe end marker without a start marker (line ${block.line}).`,
        "Repair the markers manually; Syngraphe will not guess where the block ends.",
      );
  }
}

/**
 * Turn a managed-file state into a plan.
 *
 * Only two outcomes ever write: creating a missing file, and inserting a block
 * into a file that has none. Everything else is reported, never repaired
 * silently.
 */
export function planManagedFile(
  fileState: ManagedFileState,
  expectedBody: string,
  summary: string,
): Plan {
  const plan = emptyPlan();

  switch (fileState.status) {
    case "ready":
      plan.unchanged.push({ path: fileState.path, reason: "already up to date" });
      return plan;

    case "missing":
      if (fileState.content === null) {
        plan.operations.push({
          type: "create",
          path: fileState.path,
          contents: `${renderManagedBlock(expectedBody)}\n`,
          summary,
        });
      } else {
        plan.operations.push({
          type: "patch",
          path: fileState.path,
          before: fileState.content,
          after: insertManagedBlock(fileState.content, expectedBody),
          summary,
        });
      }
      return plan;

    default:
      plan.conflicts.push({
        path: fileState.path,
        message: fileState.message ?? `${fileState.path} cannot be updated safely.`,
        details: fileState.details,
      });
      return plan;
  }
}

function state(
  path: string,
  kind: PathKind,
  content: string | null,
  status: ManagedFileStatus,
  block: ManagedBlockState | null,
  message: string | null,
  details: string | null,
): ManagedFileState {
  return { path, kind, content, status, block, message, details };
}
