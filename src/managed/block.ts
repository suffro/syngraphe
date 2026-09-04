/**
 * Generic managed-block subsystem.
 *
 * A managed block is a region of a Markdown file delimited by HTML comments
 * that Syngraphe owns. Everything outside the markers is user-owned and must
 * survive every operation byte for byte.
 *
 * This module is deliberately independent from AGENTS.md, CLAUDE.md or any
 * agent: it only knows about text. All functions are pure.
 */

import { detectTextShape, fromLf, joinLines, splitLines, toLf } from "../core/text.ts";

export const MANAGED_BLOCK_VERSION = "1";

const START_MARKER = `<!-- syngraphe:start version="${MANAGED_BLOCK_VERSION}" -->`;
const END_MARKER = "<!-- syngraphe:end -->";

/** Matches any start marker, including versions this build does not support. */
const START_MARKER_PATTERN = /^<!--\s*syngraphe:start(?:\s+version="([^"]*)")?\s*-->$/;
const END_MARKER_PATTERN = /^<!--\s*syngraphe:end\s*-->$/;

export interface ManagedBlock {
  /** Zero-based line index of the start marker. */
  startLine: number;
  /** Zero-based line index of the end marker. */
  endLine: number;
  /** Declared marker version, or null when the marker carries none. */
  version: string | null;
  /** Content between the markers, LF normalized, without the marker lines. */
  body: string;
}

export type ManagedBlockLookup =
  | { status: "absent" }
  | { status: "found"; block: ManagedBlock }
  | { status: "duplicate"; blocks: ManagedBlock[] }
  | { status: "malformed"; reason: "unterminated" | "unexpected-end"; line: number };

export type ManagedBlockState =
  | { status: "absent" }
  | { status: "valid"; block: ManagedBlock }
  | { status: "drift"; block: ManagedBlock }
  | { status: "unsupported-version"; block: ManagedBlock }
  | { status: "duplicate"; blocks: ManagedBlock[] }
  | { status: "malformed"; reason: "unterminated" | "unexpected-end"; line: number };

/** Render a full managed block (markers included) as LF text without trailing newline. */
export function renderManagedBlock(body: string): string {
  const trimmed = toLf(body).replace(/^\n+/, "").replace(/\s+$/, "");
  return `${START_MARKER}\n${trimmed}\n${END_MARKER}`;
}

/** Locate the managed block(s) in `content`. */
export function findManagedBlock(content: string): ManagedBlockLookup {
  const lines = splitLines(toLf(content));
  const blocks: ManagedBlock[] = [];

  let openLine = -1;
  let openVersion: string | null = null;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    const start = START_MARKER_PATTERN.exec(trimmed);
    if (start) {
      if (openLine !== -1) {
        // A start marker inside an open block cannot be resolved safely.
        return { status: "malformed", reason: "unterminated", line: openLine + 1 };
      }
      openLine = index;
      openVersion = start[1] ?? null;
      continue;
    }
    if (END_MARKER_PATTERN.test(trimmed)) {
      if (openLine === -1) {
        return { status: "malformed", reason: "unexpected-end", line: index + 1 };
      }
      blocks.push({
        startLine: openLine,
        endLine: index,
        version: openVersion,
        body: lines.slice(openLine + 1, index).join("\n"),
      });
      openLine = -1;
      openVersion = null;
    }
  }

  if (openLine !== -1) {
    return { status: "malformed", reason: "unterminated", line: openLine + 1 };
  }
  if (blocks.length === 0) return { status: "absent" };
  if (blocks.length > 1) return { status: "duplicate", blocks };
  // biome-ignore lint/style/noNonNullAssertion: length checked above.
  return { status: "found", block: blocks[0]! };
}

/**
 * Compare the block found in `content` against the body Syngraphe would write.
 *
 * A block whose body was edited by hand is reported as drift and never
 * silently overwritten.
 */
export function validateManagedBlock(content: string, expectedBody: string): ManagedBlockState {
  const lookup = findManagedBlock(content);
  if (lookup.status !== "found") return lookup;

  const { block } = lookup;
  if (block.version !== MANAGED_BLOCK_VERSION) {
    return { status: "unsupported-version", block };
  }
  const expected = normalizeBody(expectedBody);
  const actual = normalizeBody(block.body);
  return actual === expected ? { status: "valid", block } : { status: "drift", block };
}

/**
 * Insert a managed block into `content`.
 *
 * Placement: immediately after a leading top-level heading when the file starts
 * with one, otherwise at the very beginning. Existing content is never
 * reordered or reformatted.
 *
 * Padding rule: exactly one blank line is inserted before the block whenever
 * content precedes it, and nothing is inserted after it. The rule is
 * unconditional so that `removeManagedBlock` can undo it without guessing
 * which blank lines were user-authored; the spacing that followed the
 * insertion point in the original file simply follows the block instead.
 *
 * Throws when a managed block is already present: replacement is a separate,
 * explicit operation.
 */
export function insertManagedBlock(content: string, body: string): string {
  const lookup = findManagedBlock(content);
  if (lookup.status !== "absent") {
    throw new Error("insertManagedBlock: content already contains a managed block");
  }

  const shape = detectTextShape(content);
  const lines = splitLines(toLf(content));
  const blockLines = renderManagedBlock(body).split("\n");

  if (lines.length === 0) {
    return fromLf(joinLines(blockLines), { lineEnding: shape.lineEnding, finalNewline: true });
  }

  const at = insertionIndex(lines);
  const segment = at > 0 ? ["", ...blockLines] : blockLines;
  const next = [...lines.slice(0, at), ...segment, ...lines.slice(at)];
  return fromLf(joinLines(next), shape);
}

/** Replace the body of the existing managed block, leaving everything else untouched. */
export function replaceManagedBlock(content: string, body: string): string {
  const lookup = findManagedBlock(content);
  if (lookup.status !== "found") {
    throw new Error("replaceManagedBlock: content does not contain exactly one managed block");
  }

  const shape = detectTextShape(content);
  const lines = splitLines(toLf(content));
  const blockLines = renderManagedBlock(body).split("\n");
  const next = [
    ...lines.slice(0, lookup.block.startLine),
    ...blockLines,
    ...lines.slice(lookup.block.endLine + 1),
  ];
  return fromLf(joinLines(next), shape);
}

/**
 * Remove the managed block, undoing the blank line `insertManagedBlock` adds
 * before it. This is the exact inverse of insertion for any content Syngraphe
 * produced, so user-authored text is recovered byte for byte.
 */
export function removeManagedBlock(content: string): string {
  const lookup = findManagedBlock(content);
  if (lookup.status !== "found") {
    throw new Error("removeManagedBlock: content does not contain exactly one managed block");
  }

  const shape = detectTextShape(content);
  const lines = splitLines(toLf(content));
  const { startLine, endLine } = lookup.block;
  const before = lines.slice(0, startLine);
  // Drop the separator insertion added; a hand-removed separator is left alone.
  if (before.at(-1) === "") before.pop();
  const next = [...before, ...lines.slice(endLine + 1)];

  if (next.length === 0) return "";
  return fromLf(joinLines(next), shape);
}

function insertionIndex(lines: string[]): number {
  const first = lines[0]?.trim() ?? "";
  return /^#\s+\S/.test(first) ? 1 : 0;
}

function normalizeBody(body: string): string {
  return splitLines(`${toLf(body).trim()}\n`)
    .map((line) => line.trimEnd())
    .join("\n");
}
