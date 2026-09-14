/**
 * The single place where Syngraphe touches the filesystem.
 *
 * Commands never call `node:fs` directly: they go through the repository
 * abstraction, which goes through here. Every write stages the complete file in
 * a temporary file beside its destination and then publishes it, so an
 * interrupted run cannot leave a user file half written. How a file is
 * published depends on what the caller is entitled to replace:
 *
 * - `writeTextFileAtomic` renames over the destination, replacing whatever is
 *   there.
 * - `createTextFileExclusive` links the staged file into place, which fails if
 *   the destination exists.
 * - `replaceTextFileIfUnchanged` moves the destination aside, compares the
 *   bytes it moved, and only then links the staged file into place.
 *
 * The last two decide "may I publish?" inside the operations that publish. A
 * separate `pathKind` check or read before a rename is a time-of-check/
 * time-of-use race.
 */

import { randomBytes } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { SyngrapheError } from "./errors.ts";
import { EXIT_INTEGRITY_FAILURE, EXIT_USAGE } from "./exit-codes.ts";

export type PathKind = "file" | "directory" | "symlink" | "other" | "missing";

type LinkFile = (existingPath: string, newPath: string) => Promise<void>;
type RenameFile = (oldPath: string, newPath: string) => Promise<void>;

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function isNotFound(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === "EEXIST";
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

/**
 * Read a UTF-8 text file, or null when it does not exist.
 *
 * Invalid sequences decode to U+FFFD, which is fine for reading and wrong for
 * editing: anything that will be patched is decoded with `decodeUtf8Exact`.
 */
export async function readTextFile(absolutePath: string): Promise<string | null> {
  return (await readBinaryFile(absolutePath))?.toString("utf8") ?? null;
}

/**
 * Decode UTF-8 only when the text encodes back to exactly the same bytes.
 *
 * A patch is computed on text but published as bytes, so a lossy decode would
 * rewrite bytes the patch never meant to touch. A byte order mark survives: it
 * decodes to U+FEFF and encodes back unchanged.
 */
export function decodeUtf8Exact(bytes: Buffer): string | null {
  const text = bytes.toString("utf8");
  return Buffer.from(text, "utf8").equals(bytes) ? text : null;
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

export interface WriteGuard {
  check(): Promise<void>;
  prepare(): Promise<void>;
}

/**
 * Remember directory identities from the trust root down. Recheck them at each
 * IO boundary, including cleanup, and never resume after detecting a change.
 * This detects swaps between phases; path-based Node APIs cannot exclude a
 * hostile swap between an individual check and syscall (no portable openat).
 */
export async function createWriteGuard(root: string, directory: string): Promise<WriteGuard> {
  const relative = path.relative(root, directory);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new SyngrapheError(
      `Write directory escapes the repository root: ${directory}`,
      EXIT_USAGE,
    );
  }
  const directories = [root];
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    directories.push(current);
  }
  const identities = new Map<string, { dev: bigint; ino: bigint }>();
  let failure: unknown;

  async function inspect(directory: string): Promise<void> {
    const stats = await lstat(directory, { bigint: true });
    if (stats.isSymbolicLink()) {
      throw new SyngrapheError(`Refusing to write through a symlink: ${directory}`, EXIT_USAGE);
    }
    const expected = identities.get(directory);
    if (
      !stats.isDirectory() ||
      (expected && (stats.dev !== expected.dev || stats.ino !== expected.ino))
    ) {
      throw new SyngrapheError(`Write directory changed: ${directory}`, EXIT_USAGE);
    }
    identities.set(directory, { dev: stats.dev, ino: stats.ino });
  }

  for (const directory of directories) {
    try {
      await inspect(directory);
    } catch (error) {
      if (directory !== root && isNotFound(error)) break;
      throw error;
    }
  }

  const guard: WriteGuard = {
    async check() {
      if (failure !== undefined) throw failure;
      try {
        for (const directory of identities.keys()) await inspect(directory);
      } catch (error) {
        failure = isNotFound(error)
          ? new SyngrapheError(`Write directory changed: ${directory}`, EXIT_USAGE)
          : error;
        throw failure;
      }
    },
    async prepare() {
      // Do not use recursive mkdir: validate each parent before creating its child.
      for (const directory of directories) {
        await guard.check();
        if (identities.has(directory)) continue;
        try {
          await mkdir(directory);
        } catch (error) {
          if (!isAlreadyExists(error)) throw error;
        }
        await inspect(directory);
      }
      await guard.check();
    },
  };
  return guard;
}

async function cleanupFile(file: string, guard: WriteGuard): Promise<void> {
  try {
    await guard.check();
    await unlink(file);
  } catch {
    // A changed parent makes even unlink unsafe. Leave the temporary file where
    // it went instead of following a replacement directory during cleanup.
  }
}

async function writeExclusive(
  file: string,
  contents: string | Buffer,
  guard: WriteGuard,
): Promise<void> {
  await guard.check();
  const handle = await open(file, "wx", 0o644);
  try {
    // Validate after opening too, before any content is written. The descriptor
    // keeps subsequent writes attached to the opened file if its name moves.
    await guard.check();
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
}

/** Fully resolved path, or null when it cannot be resolved (broken link, missing). */
export async function resolveRealPath(absolutePath: string): Promise<string | null> {
  try {
    return await realpath(absolutePath);
  } catch {
    return null;
  }
}

/** A name in `directory` no other run will pick, for a file that must not outlive the call. */
function temporaryPath(directory: string, extension: "tmp" | "aside"): string {
  return path.join(directory, `.syngraphe-${randomBytes(6).toString("hex")}.${extension}`);
}

/**
 * Write the whole file into the destination directory under a temporary name.
 *
 * Staging beside the destination keeps publication on one filesystem, which is
 * what every publish operation needs to be atomic.
 */
async function stageTextFile(
  directory: string,
  contents: string,
  guard: WriteGuard,
): Promise<string> {
  await guard.prepare();
  const temporary = temporaryPath(directory, "tmp");
  try {
    await writeExclusive(temporary, contents, guard);
  } catch (error) {
    if (!isAlreadyExists(error)) await cleanupFile(temporary, guard);
    throw error;
  }
  return temporary;
}

/**
 * Make the complete file at `source` visible as `destination`, unless the
 * destination already exists. Returns false when it does.
 *
 * `link` is the publish operation because it is the one Node exposes that both
 * fails when the destination exists and makes an already complete file visible
 * under its final name in a single step. `rename` replaces silently, and
 * `renameat2(RENAME_NOREPLACE)` has no Node binding.
 */
async function publishExclusive(
  source: string,
  destination: string,
  contents: string | Buffer,
  linkFile: LinkFile,
  guard: WriteGuard,
): Promise<boolean> {
  await guard.check();
  try {
    // link() never follows a symlink at the destination: an existing link is
    // itself an EEXIST, so this cannot write through one.
    await linkFile(source, destination);
    return true;
  } catch (error) {
    if (isAlreadyExists(error)) return false;
    // Missing paths, IO errors and disk exhaustion are not evidence that links
    // are unsupported. Never turn those failures into a new write attempt.
    if (!["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV"].includes(errorCode(error) ?? "")) {
      throw error;
    }
    // Hard links are unavailable on some filesystems Node runs on (FAT, parts
    // of exFAT, some network shares). O_EXCL still decides the winner there, so
    // exclusivity is kept; only the "complete file or nothing" window is lost,
    // and solely on those filesystems.
    try {
      await writeExclusive(destination, contents, guard);
      return true;
    } catch (fallbackError) {
      if (isAlreadyExists(fallbackError)) return false;
      throw fallbackError;
    }
  }
}

/**
 * Write `contents` as a complete file, replacing any existing destination.
 *
 * Nothing is compared or claimed first, so this offers no protection against a
 * concurrent writer. Plan operations never use it: they publish through
 * `createTextFileExclusive` and `replaceTextFileIfUnchanged`.
 */
export async function writeTextFileAtomic(
  absolutePath: string,
  contents: string,
  guard?: WriteGuard,
): Promise<void> {
  guard ??= await createWriteGuard(path.parse(absolutePath).root, path.dirname(absolutePath));
  const temporary = await stageTextFile(path.dirname(absolutePath), contents, guard);
  try {
    await guard.check();
    await rename(temporary, absolutePath);
    await guard.check();
  } finally {
    await cleanupFile(temporary, guard);
  }
}

/**
 * Publish `contents` at `absolutePath` only if nothing is there yet.
 *
 * Returns true when this call created the file and false when the destination
 * already existed — including when a concurrent process created it a moment
 * earlier. The destination is never replaced.
 */
export async function createTextFileExclusive(
  absolutePath: string,
  contents: string,
  // Replaceable only so tests can reach the fallback on hosts where links work.
  linkFile: LinkFile = link,
  guard?: WriteGuard,
): Promise<boolean> {
  guard ??= await createWriteGuard(path.parse(absolutePath).root, path.dirname(absolutePath));
  const temporary = await stageTextFile(path.dirname(absolutePath), contents, guard);
  try {
    const published = await publishExclusive(temporary, absolutePath, contents, linkFile, guard);
    await guard.check();
    return published;
  } finally {
    await cleanupFile(temporary, guard);
  }
}

/**
 * Replace the file at `absolutePath` only if it still holds exactly `expected`.
 *
 * Returns true when this call published `contents`, and false when the file was
 * missing or held other bytes, in which case it is put back as found.
 *
 * Reading the file and then renaming over it would lose an edit made in
 * between. Instead the file is first renamed aside, and the bytes compared are
 * the ones under the aside name: a writer that opens the path from then on
 * reaches a new file, never the compared one, and the publishing `link` fails
 * if such a file exists. Readers may briefly see the path missing.
 *
 * Not covered: a process that already has the original open and writes through
 * that descriptor after the comparison. Its write lands in the file moved
 * aside, which is then removed. Node offers no way to exclude that writer.
 *
 * On Windows a rename goes through a handle opened by name, so a concurrent run
 * that opened the path first can move the file on after this call moved it. If
 * it is gone before it is read, the call returns false; if both runs read it,
 * only one can publish and the other fails closed.
 *
 * If the path is taken while the original is aside, neither file is discarded:
 * the error names the preserved one.
 */
export async function replaceTextFileIfUnchanged(
  absolutePath: string,
  expected: Buffer,
  contents: string,
  // Replaceable only so tests can reach the concurrent, fallback and busy paths.
  linkFile: LinkFile = link,
  renameFile: RenameFile = rename,
  guard?: WriteGuard,
): Promise<boolean> {
  const directory = path.dirname(absolutePath);
  guard ??= await createWriteGuard(path.parse(absolutePath).root, directory);
  const staged = await stageTextFile(directory, contents, guard);
  const aside = temporaryPath(directory, "aside");
  // True while the file that was at `absolutePath` exists only as `aside`.
  let asideHoldsOriginal = false;
  try {
    try {
      await guard.check();
      await renameFile(absolutePath, aside);
    } catch (error) {
      if (isNotFound(error)) return false;
      // Windows refuses to rename a file another process holds open. Fail
      // closed: nothing has moved, and retrying would only race that process.
      const code = errorCode(error);
      if (code === "EPERM" || code === "EBUSY") {
        throw new SyngrapheError(
          `Cannot patch ${absolutePath}: it could not be moved aside to verify it (${code}).`,
          EXIT_INTEGRITY_FAILURE,
          "Nothing was changed. Another process may have the file open; close it and re-run.",
        );
      }
      throw error;
    }
    asideHoldsOriginal = true;

    let current: Buffer;
    try {
      await guard.check();
      const kind = await pathKind(aside);
      if (kind !== "file" && kind !== "missing") {
        throw new Error("the moved path is not a regular file");
      }
      current = await readFile(aside);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // Another writer moved the file on before it was read, as a concurrent
      // Windows rename can. Nothing of ours is at `aside` and nothing was
      // published, so this is a changed file like any other.
      asideHoldsOriginal = false;
      return false;
    }
    const unchanged = current.equals(expected);
    const published = unchanged
      ? await publishExclusive(staged, absolutePath, contents, linkFile, guard)
      : await publishExclusive(aside, absolutePath, current, linkFile, guard);
    if (!published) throw preservedAside(absolutePath, aside, "the path was recreated meanwhile");
    await guard.check();
    asideHoldsOriginal = false;
    return unchanged;
  } catch (error) {
    if (asideHoldsOriginal) {
      const preserved = preservedAside(
        absolutePath,
        aside,
        error instanceof Error ? error.message : error,
      );
      // Unsafe paths must keep their usage code (the Action never suppresses it).
      if (error instanceof SyngrapheError && error.exitCode === EXIT_USAGE) {
        throw new SyngrapheError(
          preserved.message,
          EXIT_USAGE,
          `The original was moved to ${path.basename(aside)} in the directory originally at ${directory}. That directory changed; cleanup was stopped. Restore the directory before recovering the file.`,
        );
      }
      if (!(error instanceof SyngrapheError)) throw preserved;
    }
    throw error;
  } finally {
    await cleanupFile(staged, guard);
    if (!asideHoldsOriginal) await cleanupFile(aside, guard);
  }
}

function preservedAside(absolutePath: string, aside: string, reason: unknown): SyngrapheError {
  return new SyngrapheError(
    `Cannot patch ${absolutePath}: ${String(reason)}.`,
    EXIT_INTEGRITY_FAILURE,
    `The file it held before is preserved at ${aside}. Compare the two, keep what you need, and re-run.`,
  );
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
