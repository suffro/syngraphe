import type { AgentIntegration } from "../types.ts";
import { createNativeIntegration } from "./native.ts";

/** Cursor reads `AGENTS.md`; its own rule files are user-owned. */
export const cursorIntegration: AgentIntegration = createNativeIntegration({
  id: "cursor",
  displayName: "Cursor",
  evidencePaths: [".cursor/rules/", ".cursorrules"],
});
