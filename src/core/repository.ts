/**
 * The repository Syngraphe operates on.
 *
 * IO uses paths relative to the selected scope (the Git root by default). The
 * class owns path safety: a path that escapes the scope, or would be written
 * through a symlink, is rejected before any filesystem call happens.
 */

import path from "node:path";
import { SyngrapheError } from "./errors.ts";
import { EXIT_USAGE } from "./exit-codes.ts";
import {
  createTextFileExclusive,
  ensureDirectory,
  fileSize,
  listDirectory,
  type PathKind,
  pathKind,
  readBinaryFile,
  readTextFile,
  resolveRealPath,
  writeTextFileAtomic,
} from "./fs.ts";
import { createGitClient, type GitClient } from "./git.ts";

export class Repository {
  readonly root: string;
  readonly git: GitClient;
  readonly gitRoot: string;
  readonly scope: string;

  private constructor(root: string, git: GitClient, gitRoot = root) {
    this.root = root;
    this.git = git;
    this.gitRoot = gitRoot;
    this.scope = toPosix(path.relative(gitRoot, root)) || ".";
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

  /** Select an existing directory relative to the Git root; never follow symlinked scopes. */
  async inScope(scope: string): Promise<Repository> {
    const base = Repository.atRoot(this.gitRoot);
    if (scope.includes("\\")) {
      throw new SyngrapheError("Scope paths must use forward slashes.", EXIT_USAGE);
    }
    const relative = path.relative(base.root, path.resolve(base.root, scope));
    if (path.isAbsolute(scope) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
      throw new SyngrapheError(`Scope must stay inside the Git repository: ${scope}`, EXIT_USAGE);
    }
    if (
      toPosix(relative)
        .split("/")
        .some((part) => part === ".git" || part === ".context")
    ) {
      throw new SyngrapheError("A scope cannot be inside .git or .context metadata.", EXIT_USAGE);
    }
    const absolute = base.resolve(scope);
    await base.assertWritable(scope, absolute);
    if ((await base.kind(scope)) !== "directory") {
      throw new SyngrapheError(`Scope is not an existing directory: ${scope}`, EXIT_USAGE);
    }
    const git = createGitClient(absolute);
    const discoveredRoot = await git.root();
    if (discoveredRoot === null || path.resolve(discoveredRoot) !== this.gitRoot) {
      throw new SyngrapheError(`Scope belongs to another Git repository: ${scope}`, EXIT_USAGE);
    }
    return new Repository(absolute, git, this.gitRoot);
  }

  /** Absolute path of a repository-relative path, rejecting anything outside the root. */
  resolve(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      throw new SyngrapheError(`Absolute path outside repository control: ${relativePath}`);
    }
    const absolute = path.resolve(this.root, relativePath);
    const relative = path.relative(this.root, absolute);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
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

  async size(relativePath: string): Promise<number> {
    return fileSize(this.resolve(relativePath));
  }

  async readBytes(relativePath: string): Promise<Buffer | null> {
    return readBinaryFile(this.resolve(relativePath));
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
   * Write a complete file, replacing an existing one, after checking that
   * neither the target nor any of its parent directories is a symlink.
   * Syngraphe refuses to write through links rather than trying to decide which
   * ones are safe.
   */
  async write(relativePath: string, contents: string): Promise<void> {
    const absolute = this.resolve(relativePath);
    await this.assertWritablePath(relativePath);
    await ensureDirectory(path.dirname(absolute));
    await writeTextFileAtomic(absolute, contents);
  }

  /**
   * Create a complete file that must not exist yet, under the same path-safety
   * rules as `write`.
   *
   * Returns false instead of replacing anything when the destination is already
   * taken. Exclusivity comes from the publishing operation itself, so a caller
   * that first asked `kind()` is still safe if the answer went stale.
   */
  async create(relativePath: string, contents: string): Promise<boolean> {
    const absolute = this.resolve(relativePath);
    await this.assertWritablePath(relativePath);
    return createTextFileExclusive(absolute, contents);
  }

  async makeDirectory(relativePath: string): Promise<void> {
    const absolute = this.resolve(relativePath);
    await this.assertWritablePath(relativePath);
    await ensureDirectory(absolute);
  }

  async assertWritablePath(relativePath: string): Promise<void> {
    // Include the scope's ancestors: a scope may have changed since selection.
    const base = Repository.atRoot(this.gitRoot);
    const absolute = this.resolve(relativePath);
    await base.assertWritable(base.relativize(absolute), absolute);
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
