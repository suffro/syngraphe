/**
 * Temporary-repository helper.
 *
 * Syngraphe modifies user repositories, so integration tests run against real
 * Git working trees in the system temporary directory. Every repository is
 * created fresh and removed afterwards.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { main } from "../../src/cli/main.ts";
import { createCapturedOutput } from "../../src/cli/output.ts";

const run = promisify(execFile);

export interface CommitOptions {
  /** ISO date used for both author and committer, for deterministic ages. */
  date?: string;
}

export class TempRepo {
  readonly root: string;

  private constructor(root: string) {
    this.root = root;
  }

  static async create(files: Record<string, string> = {}): Promise<TempRepo> {
    const base = await mkdtemp(path.join(os.tmpdir(), "syngraphe-test-"));
    // macOS temporary directories are symlinked; Git reports the real path.
    const root = await realpath(base);
    await run("git", ["init", "-q", "-b", "main"], { cwd: root });
    await run("git", ["config", "user.email", "test@example.com"], { cwd: root });
    await run("git", ["config", "user.name", "Syngraphe Test"], { cwd: root });

    const repo = new TempRepo(root);
    for (const [file, contents] of Object.entries(files)) {
      await repo.write(file, contents);
    }
    return repo;
  }

  path(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  async write(relativePath: string, contents: string): Promise<void> {
    const target = this.path(relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }

  async read(relativePath: string): Promise<string> {
    return readFile(this.path(relativePath), "utf8");
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await readFile(this.path(relativePath));
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "ENOENT";
    }
  }

  async makeDirectory(relativePath: string): Promise<void> {
    await mkdir(this.path(relativePath), { recursive: true });
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.path(relativePath), { recursive: true, force: true });
  }

  async link(target: string, linkPath: string): Promise<void> {
    await symlink(target, this.path(linkPath));
  }

  async git(args: string[], options: CommitOptions = {}): Promise<string> {
    const env = { ...process.env };
    if (options.date) {
      env.GIT_AUTHOR_DATE = options.date;
      env.GIT_COMMITTER_DATE = options.date;
    }
    const { stdout } = await run("git", args, { cwd: this.root, env });
    return stdout;
  }

  async commitAll(message: string, options: CommitOptions = {}): Promise<void> {
    await this.git(["add", "-A"]);
    await this.git(["commit", "-q", "-m", message], options);
  }

  /** Every tracked-or-untracked file below the root, excluding `.git`. */
  async snapshot(): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    await collect(this.root, this.root, files);
    return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  /**
   * Git's own state: hashes of HEAD, the index, every loose ref, packed-refs
   * and config, plus Git's report of the worktree, HEAD and object store.
   *
   * Status runs without optional locks: a plain `git status` may refresh the
   * index, and the snapshot would then change what it measures.
   */
  async gitSnapshot(): Promise<Map<string, string>> {
    const gitDirectory = this.path(".git");
    const state = new Map<string, string>();
    for (const file of ["HEAD", "index", "packed-refs", "config"]) {
      state.set(file, await hashFile(path.join(gitDirectory, file)));
    }
    const refs = await readdir(path.join(gitDirectory, "refs"), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of refs) {
      if (!entry.isFile()) continue;
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path.relative(gitDirectory, absolute).split(path.sep).join("/");
      state.set(relative, await hashFile(absolute));
    }
    for (const args of [
      ["status", "--porcelain=v2"],
      ["rev-parse", "HEAD"],
      ["count-objects", "-v"],
    ]) {
      state.set(args.join(" "), await this.git(["--no-optional-locks", ...args]));
    }
    return state;
  }

  async cleanup(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }
}

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the CLI in-process against a temporary repository. */
export async function runCli(repo: TempRepo, argv: string[]): Promise<CliRun> {
  const output = createCapturedOutput();
  const code = await main(argv, { output, cwd: repo.root });
  return { code, stdout: output.stdout, stderr: output.stderr };
}

async function hashFile(absolutePath: string): Promise<string> {
  try {
    return createHash("sha256")
      .update(await readFile(absolutePath))
      .digest("hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "<missing>";
    throw error;
  }
}

async function collect(root: string, directory: string, into: Map<string, string>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      await collect(root, absolute, into);
    } else if (entry.isSymbolicLink()) {
      into.set(relative, "<symlink>");
    } else {
      into.set(relative, await readFile(absolute, "utf8"));
    }
  }
}
