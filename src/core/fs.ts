/**
 * The single place where Syngraphe touches the filesystem.
 *
 * Commands never call `node:fs` directly: they go through the repository
 * abstraction, which goes through here. Every write stages the complete file in
 * a temporary file beside its destination and then publishes it, so an
 * interrupted run cannot leave a user file half written. There are two ways to
 * publish, because replacing a known file and creating a file that must not
 * exist yet are different guarantees:
 *
 * - `writeTextFileAtomic` renames over the destination, replacing whatever is
 *   there.
 * - `createTextFileExclusive` links the staged file into place, which fails if
 *   the destination exists. Deciding "is it missing?" and "claim it" in one
 *   filesystem operation is what makes concurrent creates safe; a separate
 *   `pathKind` check before a rename is a time-of-check/time-of-use race.
 */

import { randomBytes } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type PathKind = "file" | "directory" | "symlink" | "other" | "missing";

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "EEXIST";
}

/** Classify a path without following a final symlink. */
export async function pathKind(absolutePath: string): Promise<PathKind> {
  try {
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) return "symlink";
    if (stats.isDirectory()) return "directory";
    if (stats.isFile()) return "file";
    return "other";
  } catch (error) {
    if (isNotFound(error)) return "missing";
    throw error;
  }
}

/** Read a UTF-8 text file, or null when it does not exist. */
export async function readTextFile(absolutePath: string): Promise<string | null> {
  return (await readBinaryFile(absolutePath))?.toString("utf8") ?? null;
}

/** List directory entry names, or null when the directory does not exist. */
export async function listDirectory(absolutePath: string): Promise<string[] | null> {
  try {
    return await readdir(absolutePath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function ensureDirectory(absolutePath: string): Promise<void> {
  await mkdir(absolutePath, { recursive: true });
}

/** Fully resolved path, or null when it cannot be resolved (broken link, missing). */
export async function resolveRealPath(absolutePath: string): Promise<string | null> {
  try {
    return await realpath(absolutePath);
  } catch {
    return null;
  }
}

/**
 * Write the whole file into the destination directory under a temporary name.
 *
 * Staging beside the destination keeps publication on one filesystem, which is
 * what both publish operations need to be atomic.
 */
async function stageTextFile(directory: string, contents: string): Promise<string> {
  await ensureDirectory(directory);
  const temporary = path.join(directory, `.syngraphe-${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o644 });
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  return temporary;
}

/**
 * Write `contents` as a complete file, replacing any existing destination.
 *
 * This is the update path: the caller has already established what the file
 * contains. It offers no protection against a concurrent writer, so it must not
 * be used to create a file that is required to be new.
 */
export async function writeTextFileAtomic(absolutePath: string, contents: string): Promise<void> {
  const temporary = await stageTextFile(path.dirname(absolutePath), contents);
  try {
    await rename(temporary, absolutePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/**
 * Publish `contents` at `absolutePath` only if nothing is there yet.
 *
 * Returns true when this call created the file and false when the destination
 * already existed — including when a concurrent process created it a moment
 * earlier. The destination is never replaced.
 *
 * `link` is the publish operation because it is the one Node exposes that both
 * fails when the destination exists and makes an already complete file visible
 * under its final name in a single step. `rename` replaces silently, and
 * `renameat2(RENAME_NOREPLACE)` has no Node binding.
 */
export async function createTextFileExclusive(
  absolutePath: string,
  contents: string,
  // Replaceable only so tests can reach the fallback on hosts where links work.
  linkFile: (existingPath: string, newPath: string) => Promise<void> = link,
): Promise<boolean> {
  const temporary = await stageTextFile(path.dirname(absolutePath), contents);
  try {
    // link() never follows a symlink at the destination: an existing link is
    // itself an EEXIST, so this cannot write through one.
    await linkFile(temporary, absolutePath);
    return true;
  } catch (error) {
    if (isAlreadyExists(error)) return false;
    // Hard links are unavailable on some filesystems Node runs on (FAT, parts
    // of exFAT, some network shares). O_EXCL still decides the winner there, so
    // exclusivity is kept; only the "complete file or nothing" window is lost,
    // and solely on those filesystems.
    try {
      await writeFile(absolutePath, contents, { encoding: "utf8", mode: 0o644, flag: "wx" });
      return true;
    } catch (fallbackError) {
      if (isAlreadyExists(fallbackError)) return false;
      throw fallbackError;
    }
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

/** File length in bytes, without reading a binary file as UTF-8. */
export async function fileSize(absolutePath: string): Promise<number> {
  return (await lstat(absolutePath)).size;
}

/** Read exact bytes, or null when the path is absent. */
export async function readBinaryFile(absolutePath: string): Promise<Buffer | null> {
  try {
    return await readFile(absolutePath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Unique runner-owned report directory; never place action reports in the inspected checkout. */
export async function createTemporaryDirectory(parent: string, prefix: string): Promise<string> {
  return mkdtemp(path.join(parent, prefix));
}
