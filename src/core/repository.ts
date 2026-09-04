/**
 * The repository Syngraphe operates on.
 *
 * Everything is addressed with repository-relative POSIX paths. The class owns
 * path safety: a path that escapes the Git root, or that would be written
 * through a symlink, is rejected before any filesystem call happens.
 */

import path from "node:path";
import { SyngrapheError } from "./errors.ts";
import { EXIT_USAGE } from "./exit-codes.ts";
import {
  ensureDirectory,
  listDirectory,
  type PathKind,
  pathKind,
  readTextFile,
  resolveRealPath,
  writeTextFileAtomic,
} from "./fs.ts";
import { createGitClient, type GitClient } from "./git.ts";

export class Repository {
  readonly root: string;
  readonly git: GitClient;

  private constructor(root: string, git: GitClient) {
    this.root = root;
    this.git = git;
  }

  /** Discover the Git root containing `cwd`. */
  static async open(cwd: string): Promise<Repository> {
    const git = createGitClient(cwd);
    const root = await git.root();
    if (root === null) {
      throw new SyngrapheError(
        "Not inside a Git repository.",
        EXIT_USAGE,
        "Syngraphe stores repository context in the repository itself, so it must run inside a Git working tree.",
      );
    }
    const resolved = path.resolve(root);
    return new Repository(resolved, createGitClient(resolved));
  }

  /** Build a Repository for an already known root (used by tests and callers that resolved it). */
  static atRoot(root: string): Repository {
    const resolved = path.resolve(root);
    return new Repository(resolved, createGitClient(resolved));
  }

  /** Absolute path of a repository-relative path, rejecting anything outside the root. */
  resolve(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      throw new SyngrapheError(`Absolute path outside repository control: ${relativePath}`);
    }
    const absolute = path.resolve(this.root, relativePath);
    const relative = path.relative(this.root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new SyngrapheError(`Path escapes the repository root: ${relativePath}`);
    }
    return absolute;
  }

  /** Repository-relative POSIX path of an absolute path inside the repository. */
  relativize(absolutePath: string): string {
    return toPosix(path.relative(this.root, absolutePath));
  }

  async kind(relativePath: string): Promise<PathKind> {
    return pathKind(this.resolve(relativePath));
  }

  async read(relativePath: string): Promise<string | null> {
    return readTextFile(this.resolve(relativePath));
  }

  /** Fully resolved path, or null when it cannot be resolved. */
  async realPath(relativePath: string): Promise<string | null> {
    return resolveRealPath(this.resolve(relativePath));
  }

  async list(relativePath: string): Promise<string[] | null> {
    const entries = await listDirectory(this.resolve(relativePath));
    return entries === null ? null : entries.sort();
  }

  /**
   * Write a complete file, after checking that neither the target nor any of
   * its parent directories is a symlink. Syngraphe refuses to write through
   * links rather than trying to decide which ones are safe.
   */
  async write(relativePath: string, contents: string): Promise<void> {
    const absolute = this.resolve(relativePath);
    await this.assertWritable(relativePath, absolute);
    await ensureDirectory(path.dirname(absolute));
    await writeTextFileAtomic(absolute, contents);
  }

  async makeDirectory(relativePath: string): Promise<void> {
    const absolute = this.resolve(relativePath);
    await this.assertWritable(relativePath, absolute);
    await ensureDirectory(absolute);
  }

  private async assertWritable(relativePath: string, absolute: string): Promise<void> {
    const segments = toPosix(path.relative(this.root, absolute)).split("/").filter(Boolean);
    let current = this.root;
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const kind = await pathKind(current);
      if (kind === "symlink") {
        throw new SyngrapheError(
          `Refusing to write through a symlink: ${this.relativize(current)}`,
          EXIT_USAGE,
          `${relativePath} is reached through a symbolic link. Resolve it manually and re-run.`,
        );
      }
      const isLast = index === segments.length - 1;
      if (!isLast && kind !== "directory" && kind !== "missing") {
        throw new SyngrapheError(
          `Expected a directory at ${this.relativize(current)}`,
          EXIT_USAGE,
          `${relativePath} cannot be written because a parent path is not a directory.`,
        );
      }
    }
  }
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
