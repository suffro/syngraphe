/**
 * Concurrency regression coverage for `applyPlan`.
 *
 * Two processes can both plan the same missing destination, because planning
 * only reads. The dangerous window is between the apply preflight and the
 * write, and it is entered deliberately here rather than hoped for: a barrier
 * holds every participant until all of them have passed their preflight, so the
 * publishing operation is what decides the winner.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { planDocument } from "../src/commands/documents.ts";
import { planInitialization } from "../src/commands/init.ts";
import { SyngrapheError } from "../src/core/errors.ts";
import { EXIT_INTEGRITY_FAILURE } from "../src/core/exit-codes.ts";
import { applyPlan, type Plan } from "../src/core/plan.ts";
import { Repository } from "../src/core/repository.ts";
import { CURRENT_STATE_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

interface Participant {
  label: string;
  repository: Repository;
  plan: Plan;
}

async function initialized(): Promise<TempRepo> {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  assert.equal((await runCli(repo, ["init"])).code, 0);
  return repo;
}

/** Release every participant only once all of them have arrived. */
function barrier(participants: number): () => Promise<void> {
  let arrived = 0;
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === participants) open();
    await opened;
  };
}

/**
 * Make every participant reach its first create at the same moment.
 *
 * Wrapping `create` rather than the plan keeps the preflight, the path-safety
 * checks and the publishing operation exactly as the real commands run them.
 */
function synchronizeCreates(participants: Participant[]): void {
  const wait = barrier(participants.length);
  for (const { repository } of participants) {
    const create = repository.create.bind(repository);
    let waited = false;
    repository.create = async (path: string, contents: string): Promise<boolean> => {
      if (!waited) {
        waited = true;
        await wait();
      }
      return create(path, contents);
    };
  }
}

/** Apply every plan concurrently; assert exactly one won and the rest failed. */
async function applyConcurrently(participants: Participant[]): Promise<Participant> {
  synchronizeCreates(participants);
  const results = await Promise.allSettled(
    participants.map(({ repository, plan }) => applyPlan(repository, plan)),
  );

  const winners = participants.filter((_, index) => results[index]?.status === "fulfilled");
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  assert.equal(winners.length, 1, `exactly one apply must succeed, got ${winners.length}`);
  assert.equal(failures.length, participants.length - 1);

  for (const failure of failures) {
    assert.ok(failure instanceof SyngrapheError, `unexpected error: ${failure}`);
    assert.match(failure.message, /already exists/);
    assert.equal(failure.exitCode, EXIT_INTEGRITY_FAILURE);
  }

  const [winner] = winners;
  assert.ok(winner);
  return winner;
}

/** The exact bytes the plan intended to publish. */
function createdContents(plan: Plan): string {
  for (const operation of plan.operations) {
    if (operation.type === "create") return operation.contents;
  }
  throw new Error("the plan has no create operation");
}

describe("concurrent applies of the same create", () => {
  it("lets one writer win a document and never replaces it", async () => {
    const repo = await initialized();
    const target = ".context/decisions/shared.md";

    // Every plan is built while the destination is still missing, so all three
    // pass the preflight the old implementation relied on.
    const participants: Participant[] = [];
    for (const label of ["First writer", "Second writer", "Third writer"]) {
      const repository = Repository.atRoot(repo.root);
      const plan = await planDocument(repository, "decision", "shared", { title: label });
      assert.equal(await repository.kind(target), "missing");
      participants.push({ label, repository, plan });
    }

    const winner = await applyConcurrently(participants);

    // Byte for byte: no loser replaced the file or appended to it, and the
    // winner's contents were complete before the name existed.
    const published = await repo.read(target);
    assert.equal(published, createdContents(winner.plan));
    assert.match(published, new RegExp(`^# ${winner.label}\n`));
    for (const participant of participants) {
      if (participant !== winner) assert.doesNotMatch(published, new RegExp(participant.label));
    }
  });

  it("leaves no temporary file behind when a create loses the race", async () => {
    const repo = await initialized();
    const participants: Participant[] = [];
    for (const label of ["One", "Two"]) {
      const repository = Repository.atRoot(repo.root);
      const plan = await planDocument(repository, "history", "note", { title: label });
      participants.push({ label, repository, plan });
    }

    await applyConcurrently(participants);

    const leftovers = [...(await repo.snapshot()).keys()].filter((file) => file.includes(".tmp"));
    assert.deepEqual(leftovers, []);
  });

  it("keeps concurrent initialization identical to a single initialization", async () => {
    const reference = await TempRepo.create();
    after(() => reference.cleanup());
    assert.equal((await runCli(reference, ["init"])).code, 0);

    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    const participants: Participant[] = [];
    for (const label of ["first init", "second init"]) {
      const repository = Repository.atRoot(repo.root);
      participants.push({ label, repository, plan: await planInitialization(repository) });
    }

    await applyConcurrently(participants);

    assert.deepEqual(await repo.snapshot(), await reference.snapshot());
    assert.equal((await runCli(repo, ["check"])).code, 0);
  });

  it("does not reset current state when an archive loses the race", async () => {
    const repo = await initialized();
    const current = "# Current State\n\nWork worth keeping.\n";
    await repo.write(CURRENT_STATE_PATH, current);

    const participants: Participant[] = [];
    for (const label of ["first archive", "second archive"]) {
      const repository = Repository.atRoot(repo.root);
      const plan = await planDocument(repository, "history", "done", { archive: true });
      participants.push({ label, repository, plan });
    }

    const winner = await applyConcurrently(participants);

    // The archive creates history before patching current state, so a loser
    // stops at the create and the source it was preserving stays untouched.
    assert.equal(await repo.read(".context/history/done.md"), current);
    assert.equal(winner.plan.operations.length, 2);
    assert.notEqual(await repo.read(CURRENT_STATE_PATH), current);
  });
});
