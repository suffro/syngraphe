/**
 * The single place where Syngraphe touches the filesystem.
 *
 * Commands never call `node:fs` directly: they go through the repository
 * abstraction, which goes through here. Writes are complete-file writes
 * performed with a temporary file plus rename, so an interrupted run cannot
 * leave a user file half written.
 */

import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
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
  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
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
 * Write `contents` as a complete file.
 *
 * The temporary file lives in the destination directory so the rename stays on
 * one filesystem and is therefore atomic.
 */
export async function writeTextFileAtomic(absolutePath: string, contents: string): Promise<void> {
  const directory = path.dirname(absolutePath);
  await ensureDirectory(directory);
  const temporary = path.join(directory, `.syngraphe-${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o644 });
    await rename(temporary, absolutePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
