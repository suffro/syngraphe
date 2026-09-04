/**
 * The agent-integration registry.
 *
 * Commands iterate this list; they never branch on agent identity. Adding an
 * agent means adding one adapter module, registering it here, and testing it.
 */

import { claudeIntegration } from "./integrations/claude.ts";
import { codexIntegration } from "./integrations/codex.ts";
import { cursorIntegration } from "./integrations/cursor.ts";
import type { AgentIntegration } from "./types.ts";

export const agentIntegrations: readonly AgentIntegration[] = [
  claudeIntegration,
  cursorIntegration,
  codexIntegration,
];
