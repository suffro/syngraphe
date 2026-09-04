/**
 * Minimal wrapper around the system Git executable.
 *
 * Only what v0.1 actually needs is implemented: locating the repository root
 * and reading the last commit date of a path. Git is invoked with `execFile`,
 * never through a shell, so repository paths cannot be interpreted as
 * commands.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface GitTimestamp {
  /** Commit date of the last commit touching the path, ISO 8601. */
  iso: string;
  /** The same instant as epoch milliseconds. */
  epochMs: number;
}

export interface GitClient {
  root(): Promise<string | null>;
  lastModified(relativePath: string): Promise<GitTimestamp | null>;
}

interface GitResult {
  stdout: string;
  ok: boolean;
}

export function createGitClient(cwd: string): GitClient {
  async function git(args: string[]): Promise<GitResult> {
    try {
      const { stdout } = await run("git", args, { cwd, maxBuffer: 8 * 1024 * 1024 });
      return { stdout, ok: true };
    } catch {
      // A missing executable, a non-repository directory and a failed command
      // are all "no answer available" for the callers in v0.1.
      return { stdout: "", ok: false };
    }
  }

  return {
    async root() {
      const result = await git(["rev-parse", "--show-toplevel"]);
      if (!result.ok) return null;
      const root = result.stdout.trim();
      return root === "" ? null : root;
    },

    async lastModified(relativePath) {
      const result = await git(["log", "-1", "--format=%cI", "--", relativePath]);
      if (!result.ok) return null;
      const iso = result.stdout.trim();
      if (iso === "") return null;
      const epochMs = Date.parse(iso);
      return Number.isNaN(epochMs) ? null : { iso, epochMs };
    },
  };
}
