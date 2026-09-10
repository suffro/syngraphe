import type { Output } from "../cli/output.ts";
import { SyngrapheError } from "../core/errors.ts";
import {
  EXIT_INTEGRITY_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  type ExitCode,
} from "../core/exit-codes.ts";
import { applyPlan, emptyPlan, type Plan } from "../core/plan.ts";
import { renderPlan } from "../core/render-plan.ts";
import type { Repository } from "../core/repository.ts";
import { requireContext } from "../inspectors/usable-context.ts";
import { CONTEXT_TEMPLATES, CURRENT_STATE_PATH } from "../templates/context.ts";
import {
  DOCUMENT_DIRECTORIES,
  type DocumentCategory,
  documentTemplate,
} from "../templates/documents.ts";

function documentName(name: string): string {
  const stem = name.endsWith(".md") ? name.slice(0, -3) : name;
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(stem) ||
    stem.length > 120 ||
    /^(readme|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)
  ) {
    throw new SyngrapheError(
      "Use a portable Markdown filename: letters, numbers, hyphens or underscores (max 120 characters; no reserved names).",
      EXIT_USAGE,
    );
  }
  return `${stem}.md`;
}

export async function planDocument(
  repository: Repository,
  category: DocumentCategory,
  name: string,
  options: { title?: string; archive?: boolean } = {},
): Promise<Plan> {
  const filename = documentName(name);
  if (options.archive && category !== "history") {
    throw new SyngrapheError("Current state can only be archived to history.", EXIT_USAGE);
  }
  const title = options.title ?? filename.slice(0, -3).replace(/[-_]/g, " ");
  if (
    !title.trim() ||
    [...title].some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        character === "\u2028" ||
        character === "\u2029",
    )
  ) {
    throw new SyngrapheError("The title must be a nonempty single line.", EXIT_USAGE);
  }
  await requireContext(repository);
  const target = `${DOCUMENT_DIRECTORIES[category]}/${filename}`;
  const plan = emptyPlan();
  // Refuse case-only collisions even on case-sensitive hosts for portable repositories.
  const entries = await repository.list(DOCUMENT_DIRECTORIES[category]);
  if (entries?.some((entry) => entry.toLowerCase() === filename.toLowerCase())) {
    plan.conflicts.push({
      path: target,
      message: "Document already exists; choose another name.",
      details: null,
    });
    return plan;
  }
  await repository.assertWritablePath(target);
  let contents = documentTemplate(category, title);
  if (options.archive) {
    await repository.assertWritablePath(CURRENT_STATE_PATH);
    const raw = await repository.readBytes(CURRENT_STATE_PATH);
    if (raw === null) throw new SyngrapheError("Current state is missing.", EXIT_INTEGRITY_FAILURE);
    const current = raw.toString("utf8");
    if (!Buffer.from(current, "utf8").equals(raw)) {
      throw new SyngrapheError(
        "Current state must be valid UTF-8 to archive without changing its bytes.",
        EXIT_INTEGRITY_FAILURE,
      );
    }
    contents = current;
    const template = CONTEXT_TEMPLATES.find((entry) => entry.path === CURRENT_STATE_PATH);
    if (!template) throw new Error("Missing current-state template.");
    plan.operations.push({
      type: "patch",
      path: CURRENT_STATE_PATH,
      before: current,
      after: template.contents,
      summary: "Reset current state after preserving it in history",
    });
  }
  plan.operations.unshift({ type: "create", path: target, contents });
  return plan;
}

export async function listDocuments(
  repository: Repository,
  category: DocumentCategory,
): Promise<string[]> {
  await requireContext(repository);
  const directory = DOCUMENT_DIRECTORIES[category];
  const result: string[] = [];
  for (const entry of (await repository.list(directory)) ?? []) {
    if (!entry.endsWith(".md") || entry.toLowerCase() === "readme.md") continue;
    const file = `${directory}/${entry}`;
    if ((await repository.kind(file)) === "file") result.push(file);
  }
  return result;
}

export async function runDocument(options: {
  repository: Repository;
  output: Output;
  category: DocumentCategory;
  name: string;
  title?: string;
  archive?: boolean;
  dryRun: boolean;
}): Promise<ExitCode> {
  const plan = await planDocument(options.repository, options.category, options.name, options);
  const title = options.archive ? "Syngraphe state archive" : "Syngraphe new document";
  const scope = options.repository.scope === "." ? "" : ` (scope: ${options.repository.scope})`;
  options.output.write(renderPlan(plan, `${title}${scope}`));
  if (plan.conflicts.length) return EXIT_INTEGRITY_FAILURE;
  if (options.dryRun) options.output.write("No files were modified.");
  else {
    await applyPlan(options.repository, plan);
    options.output.write(`${plan.operations.length} file(s) written.`);
  }
  return EXIT_SUCCESS;
}
