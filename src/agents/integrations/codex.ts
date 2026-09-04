import type { AgentIntegration } from "../types.ts";
import { createNativeIntegration } from "./native.ts";

/** Codex reads `AGENTS.md`; nothing vendor-specific is written for it. */
export const codexIntegration: AgentIntegration = createNativeIntegration({
  id: "codex",
  displayName: "Codex",
  evidencePaths: [".codex/"],
});
