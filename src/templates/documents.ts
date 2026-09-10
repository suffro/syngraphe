export type DocumentCategory = "decision" | "state" | "history";

export const DOCUMENT_DIRECTORIES: Record<DocumentCategory, string> = {
  decision: ".context/decisions",
  state: ".context/state",
  history: ".context/history",
};

export function documentTemplate(category: DocumentCategory, title: string): string {
  const headings = {
    decision: ["Context", "Decision", "Alternatives considered", "Consequences"],
    state: ["Current focus", "Recent relevant changes", "Next", "Blockers"],
    history: ["Summary", "Outcome", "Follow-up"],
  };
  return `# ${title}\n\n${headings[category].map((heading) => `## ${heading}\n`).join("\n")}`;
}
