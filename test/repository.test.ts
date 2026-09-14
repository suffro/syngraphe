import assert from "node:assert/strict";
import { link, readFile, rename, writeFile } from "node:fs/promises";
import { after, describe, it } from "node:test";
import { SyngrapheError } from "../src/core/errors.ts";
import { EXIT_INTEGRITY_FAILURE } from "../src/core/exit-codes.ts";
import { createTextFileExclusive, pathKind, replaceTextFileIfUnchanged } from "../src/core/fs.ts";
import { Repository } from "../src/core/repository.ts";
import { TempRepo } from "./helpers/repo.ts";

async function repository(): Promise<{ repo: TempRepo; repository: Repository }> {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  return { repo, repository: Repository.atRoot(repo.root) };
}

describe("Repository path safety", () => {
  it("resolves repository-relative paths", async () => {
    const { repo, repository: target } = await repository();
    assert.equal(target.resolve(".context/index.md"), repo.path(".context/index.md"));
  });

  it("rejects paths that escape the repository root", async () => {
    const { repository: target } = await repository();
    assert.throws(() => target.resolve("../outside.md"), /escapes the repository root/);
    assert.throws(() => target.resolve(".context/../../outside.md"), /escapes the repository root/);
  });

  it("rejects absolute paths", async () => {
    const { repository: target } = await repository();
    assert.throws(() => target.resolve("/etc/passwd"), /outside repository control/);
  });

  it("refuses to write through a symlinked directory", async () => {
    const { repo, repository: target } = await repository();
    await repo.makeDirectory("real");
    await repo.link("real", "linked");

    await assert.rejects(
      () => target.write("linked/notes.md", "content\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.exists("real/notes.md"), false);
  });

  it("refuses to overwrite a symlinked file", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("real.md", "original\n");
    await repo.link("real.md", "linked.md");

    await assert.rejects(
      () => target.write("linked.md", "replaced\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.read("real.md"), "original\n");
  });

  it("writes complete files without leaving temporary files behind", async () => {
    const { repo, repository: target } = await repository();
    await target.write("nested/deep/file.md", "content\n");

    assert.equal(await repo.read("nested/deep/file.md"), "content\n");
    const entries = [...(await repo.snapshot()).keys()];
    assert.deepEqual(entries, ["nested/deep/file.md"]);
  });

  for (const operation of ["write", "create", "replace", "makeDirectory"] as const) {
    it(`stops ${operation} when a checked parent is exchanged for an outside symlink`, async (t) => {
      const { repo, repository: target } = await repository();
      const { repo: outside } = await repository();
      await repo.write("parent/notes.md", "before\n");
      await outside.write("notes.md", "outside\n");
      const before = await outside.snapshot();
      const validate = target.assertWritablePath.bind(target);
      t.mock.method(target, "assertWritablePath", async (relative: string) => {
        await validate(relative);
        await rename(repo.path("parent"), repo.path("original-parent"));
        await repo.link(outside.root, "parent");
      });

      await assert.rejects(async () => {
        if (operation === "replace") await target.replace("parent/notes.md", "before\n", "after\n");
        else if (operation === "makeDirectory") await target.makeDirectory("parent/new/nested");
        else await target[operation]("parent/new.md", "after\n");
      }, /symlink|directory changed/i);

      assert.deepEqual(await outside.snapshot(), before);
      assert.equal(await pathKind(outside.path("new")), "missing");
      assert.equal(await repo.read("original-parent/notes.md"), "before\n");
    });
  }

  it("also rejects a checked parent replaced by another regular directory", async (t) => {
    const { repo, repository: target } = await repository();
    await repo.makeDirectory("parent");
    const validate = target.assertWritablePath.bind(target);
    t.mock.method(target, "assertWritablePath", async (relative: string) => {
      await validate(relative);
      await rename(repo.path("parent"), repo.path("original-parent"));
      await repo.makeDirectory("parent");
    });
    await assert.rejects(() => target.create("parent/new.md", "after\n"), /directory changed/i);
    assert.equal(await repo.exists("parent/new.md"), false);
  });
});

describe("Repository exclusive creation", () => {
  it("creates a missing file and reports the destination as taken afterwards", async () => {
    const { repo, repository: target } = await repository();

    assert.equal(await target.create("nested/deep/new.md", "first\n"), true);
    assert.equal(await repo.read("nested/deep/new.md"), "first\n");

    assert.equal(await target.create("nested/deep/new.md", "second\n"), false);
    assert.equal(await repo.read("nested/deep/new.md"), "first\n");
    assert.deepEqual([...(await repo.snapshot()).keys()], ["nested/deep/new.md"]);
  });

  it("refuses a destination that is not a regular file rather than replacing it", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("real.md", "original\n");
    await repo.link("real.md", "linked.md");
    await repo.makeDirectory("folder");

    await assert.rejects(
      () => target.create("linked.md", "replaced\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.read("real.md"), "original\n");
    assert.equal(await target.create("folder", "replaced\n"), false);
  });

  it("gives exactly one winner when many creates race for one path", async () => {
    const { repo, repository: target } = await repository();
    const writers = Array.from({ length: 16 }, (_, index) => `writer ${index}\n`);

    // The assertion holds under every possible interleaving: exclusivity comes
    // from the filesystem, not from the order the promises happen to resume in.
    const results = await Promise.all(writers.map((body) => target.create("contested.md", body)));

    assert.equal(results.filter(Boolean).length, 1);
    const published = await repo.read("contested.md");
    assert.equal(published, writers[results.indexOf(true)]);
    assert.deepEqual([...(await repo.snapshot()).keys()], ["contested.md"]);
  });

  it("still gives exactly one winner on filesystems without hard links", async () => {
    const { repo } = await repository();
    const noHardLinks = async (): Promise<void> => {
      throw Object.assign(new Error("hard links unsupported"), { code: "EPERM" });
    };
    const writers = Array.from({ length: 8 }, (_, index) => `writer ${index}\n`);

    const results = await Promise.all(
      writers.map((body) => createTextFileExclusive(repo.path("fallback.md"), body, noHardLinks)),
    );

    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await repo.read("fallback.md"), writers[results.indexOf(true)]);
    assert.deepEqual([...(await repo.snapshot()).keys()], ["fallback.md"]);
  });

  for (const code of ["ENOENT", "EIO", "ENOSPC"]) {
    it(`does not turn a ${code} publication failure into a fallback write`, async () => {
      const { repo } = await repository();
      const failure = Object.assign(new Error("publication failed"), { code });
      await assert.rejects(
        () =>
          createTextFileExclusive(repo.path("notes.md"), "after\n", async () => {
            throw failure;
          }),
        (error) => error === failure,
      );
      assert.equal(await repo.exists("notes.md"), false);
      assert.deepEqual([...(await repo.snapshot()).keys()], []);
    });
  }

  it("does not follow an exchanged parent when a hard-link fallback or cleanup runs", async () => {
    const { repo } = await repository();
    const { repo: outside } = await repository();
    await repo.makeDirectory("parent");
    let decoy = "";
    const swapped = async (staged: string): Promise<void> => {
      // A staged basename in the outside directory detects unsafe cleanup.
      decoy = staged.split(/[\\/]/).at(-1) ?? "";
      await outside.write(decoy, "keep\n");
      await rename(repo.path("parent"), repo.path("original-parent"));
      await repo.link(outside.root, "parent");
      throw Object.assign(new Error("links unavailable"), { code: "EPERM" });
    };
    await assert.rejects(
      () => createTextFileExclusive(repo.path("parent/new.md"), "after\n", swapped),
      /symlink|directory changed/i,
    );
    assert.equal(await outside.exists("new.md"), false);
    assert.equal(await outside.read(decoy), "keep\n");
  });
});

describe("Repository verified replacement", () => {
  const noHardLinks = async (): Promise<void> => {
    throw Object.assign(new Error("hard links unsupported"), { code: "EPERM" });
  };

  /** A link seam that lets another writer claim the path just before publication. */
  function recreatedBefore(publish: (existingPath: string, newPath: string) => Promise<void>) {
    return async (existingPath: string, newPath: string): Promise<void> => {
      await writeFile(newPath, "recreated\n", { flag: "wx" });
      await publish(existingPath, newPath);
    };
  }

  function preservedAside(error: unknown): boolean {
    return (
      error instanceof SyngrapheError &&
      error.exitCode === EXIT_INTEGRITY_FAILURE &&
      /preserved at .*\.syngraphe-[0-9a-f]+\.aside\b/.test(error.details ?? "")
    );
  }

  it("replaces a file that still holds the expected content", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("notes.md", "before\n");

    assert.equal(await target.replace("notes.md", "before\n", "after\n"), true);

    assert.equal(await repo.read("notes.md"), "after\n");
    assert.deepEqual([...(await repo.snapshot()).keys()], ["notes.md"]);
  });

  it("leaves a changed or missing file as found", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("notes.md", "edited by someone else\n");

    assert.equal(await target.replace("notes.md", "before\n", "after\n"), false);
    assert.equal(await target.replace("gone.md", "before\n", "after\n"), false);

    assert.equal(await repo.read("notes.md"), "edited by someone else\n");
    assert.deepEqual([...(await repo.snapshot()).keys()], ["notes.md"]);
  });

  it("compares bytes rather than decoded text", async () => {
    const { repo, repository: target } = await repository();
    const invalid = Buffer.from([0x41, 0xff]);
    await writeFile(repo.path("notes.md"), invalid);

    // 0xFF decodes to U+FFFD, so a text comparison would call these equal.
    const lossy = `A${String.fromCodePoint(0xfffd)}`;
    assert.equal(await target.replace("notes.md", lossy, "after\n"), false);
    assert.deepEqual(await readFile(repo.path("notes.md")), invalid);
  });

  it("refuses to replace through a symlink", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("real.md", "original\n");
    await repo.link("real.md", "linked.md");

    await assert.rejects(
      () => target.replace("linked.md", "original\n", "replaced\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.read("real.md"), "original\n");
  });

  it("gives exactly one winner when many replacements expect the same content", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("notes.md", "before\n");
    const writers = Array.from({ length: 16 }, (_, index) => `writer ${index}\n`);

    const results = await Promise.allSettled(
      writers.map((body) => target.replace("notes.md", "before\n", body)),
    );

    const winners = results.flatMap((result, index) =>
      result.status === "fulfilled" && result.value ? [writers[index]] : [],
    );
    assert.equal(winners.length, 1);
    const files = await repo.snapshot();
    assert.equal(files.get("notes.md"), winners[0]);

    // POSIX renames by name, so only one run can move the original aside and
    // every other run sees a changed file. Windows renames through a handle
    // opened by name, so two runs can both move and verify the original: one
    // publishes, the other fails closed and keeps what it moved. Either way no
    // losing run's content is ever published.
    for (const result of results) {
      if (result.status === "fulfilled") continue;
      assert.equal(process.platform, "win32", String(result.reason));
      assert.ok(preservedAside(result.reason), String(result.reason));
    }
    for (const [file, contents] of files) {
      if (file === "notes.md") continue;
      assert.equal(process.platform, "win32", file);
      assert.match(file, /\.aside$/);
      assert.ok(contents === "before\n" || contents === winners[0], contents);
    }
  });

  it("reports a file another writer moved on as changed, and leaves it where it went", async () => {
    const { repo } = await repository();
    await repo.write("notes.md", "before\n");
    // What a concurrent Windows rename through an earlier handle does.
    const movedOn = async (oldPath: string, newPath: string): Promise<void> => {
      await rename(oldPath, newPath);
      await rename(newPath, repo.path("elsewhere.md"));
    };

    assert.equal(
      await replaceTextFileIfUnchanged(
        repo.path("notes.md"),
        Buffer.from("before\n"),
        "after\n",
        link,
        movedOn,
      ),
      false,
    );

    assert.deepEqual([...(await repo.snapshot())], [["elsewhere.md", "before\n"]]);
  });

  it("preserves the original and avoids outside reads or cleanup after a parent swap during rename", async () => {
    const { repo } = await repository();
    const { repo: outside } = await repository();
    await repo.write("parent/notes.md", "before\n");
    await outside.write("notes.md", "outside\n");
    let asideName = "";
    const swapped = async (oldPath: string, newPath: string): Promise<void> => {
      await rename(oldPath, newPath);
      asideName = newPath.split(/[\\/]/).at(-1) ?? "";
      await outside.write(asideName, "keep\n");
      await rename(repo.path("parent"), repo.path("original-parent"));
      await repo.link(outside.root, "parent");
    };
    await assert.rejects(
      () =>
        replaceTextFileIfUnchanged(
          repo.path("parent/notes.md"),
          Buffer.from("before\n"),
          "after\n",
          link,
          swapped,
        ),
      (error: unknown) =>
        error instanceof SyngrapheError &&
        error.exitCode === 2 &&
        /cleanup was stopped/.test(error.details ?? ""),
    );
    assert.equal(await repo.read(`original-parent/${asideName}`), "before\n");
    assert.equal(await outside.read(asideName), "keep\n");
    assert.equal(await outside.read("notes.md"), "outside\n");
  });

  for (const code of ["EBUSY", "EPERM"]) {
    it(`fails closed without changing anything when moving aside fails with ${code}`, async () => {
      const { repo } = await repository();
      await repo.write("notes.md", "before\n");
      // How Windows refuses to rename a file another program holds open.
      const refused = async (): Promise<void> => {
        throw Object.assign(new Error("resource busy or locked"), { code });
      };

      await assert.rejects(
        () =>
          replaceTextFileIfUnchanged(
            repo.path("notes.md"),
            Buffer.from("before\n"),
            "after\n",
            link,
            refused,
          ),
        (error: unknown) =>
          error instanceof SyngrapheError &&
          error.exitCode === EXIT_INTEGRITY_FAILURE &&
          /could not be moved aside/.test(error.message) &&
          /Nothing was changed/.test(error.details ?? ""),
      );

      assert.deepEqual([...(await repo.snapshot())], [["notes.md", "before\n"]]);
    });
  }

  for (const [label, current] of [
    ["publishing a verified file", "before\n"],
    ["restoring a changed file", "edited\n"],
  ] as const) {
    it(`keeps both files when the path is recreated while ${label}`, async () => {
      const { repo } = await repository();
      await repo.write("notes.md", current);

      await assert.rejects(
        () =>
          replaceTextFileIfUnchanged(
            repo.path("notes.md"),
            Buffer.from("before\n"),
            "after\n",
            recreatedBefore(link),
          ),
        preservedAside,
      );

      const files = await repo.snapshot();
      assert.equal(files.get("notes.md"), "recreated\n");
      const aside = [...files.keys()].filter((file) => file.endsWith(".aside"));
      assert.equal(aside.length, 1);
      assert.equal(files.get(aside[0] ?? ""), current);
      assert.deepEqual(
        [...files.keys()].filter((file) => file.endsWith(".tmp")),
        [],
      );
    });
  }

  it("verifies and restores on filesystems without hard links", async () => {
    const { repo } = await repository();
    await repo.write("notes.md", "before\n");
    const file = repo.path("notes.md");

    assert.equal(
      await replaceTextFileIfUnchanged(file, Buffer.from("before\n"), "after\n", noHardLinks),
      true,
    );
    assert.equal(
      await replaceTextFileIfUnchanged(file, Buffer.from("before\n"), "again\n", noHardLinks),
      false,
    );

    assert.equal(await repo.read("notes.md"), "after\n");
    assert.deepEqual([...(await repo.snapshot()).keys()], ["notes.md"]);
  });

  it("keeps both files without hard links when the path is recreated", async () => {
    const { repo } = await repository();
    await repo.write("notes.md", "before\n");

    await assert.rejects(
      () =>
        replaceTextFileIfUnchanged(
          repo.path("notes.md"),
          Buffer.from("before\n"),
          "after\n",
          recreatedBefore(noHardLinks),
        ),
      preservedAside,
    );

    const files = await repo.snapshot();
    assert.equal(files.get("notes.md"), "recreated\n");
    assert.equal([...files.values()].filter((contents) => contents === "before\n").length, 1);
  });
});
