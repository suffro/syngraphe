import { SyngrapheError } from "../../src/core/errors.ts";
import { EXIT_USAGE } from "../../src/core/exit-codes.ts";
import { DEFAULT_TOKEN_BUDGET } from "../../src/inspectors/stats.ts";

export interface ActionOptions {
  command: "check" | "stats" | "check-and-stats";
  workingDirectory: string;
  scope?: string;
  all: boolean;
  strict: boolean;
  budget: number;
  failOnError: boolean;
  failOnBudget: boolean;
  annotations: boolean;
  summary: boolean;
  maxAnnotations: number;
}

export function readOptions(input: (name: string) => string): ActionOptions {
  const get = (name: string, fallback: string) => input(name).trim() || fallback;
  const boolean = (name: string, fallback: boolean) => {
    const value = get(name, String(fallback)).toLowerCase();
    if (value !== "true" && value !== "false") throw usage(`${name} must be true or false.`);
    return value === "true";
  };
  const integer = (name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) => {
    const value = get(name, String(fallback));
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
      throw usage(`${name} must be an integer between ${min} and ${max}.`);
    }
    return number;
  };
  const command = get("command", "check");
  if (command !== "check" && command !== "stats" && command !== "check-and-stats") {
    throw usage("command must be check, stats or check-and-stats.");
  }
  const options: ActionOptions = {
    command,
    workingDirectory: get("working-directory", "."),
    scope: input("scope").trim() || undefined,
    all: boolean("all", false),
    strict: boolean("strict", false),
    budget: integer("budget", DEFAULT_TOKEN_BUDGET, 1),
    failOnError: boolean("fail-on-error", true),
    failOnBudget: boolean("fail-on-budget", false),
    annotations: boolean("annotations", true),
    summary: boolean("summary", true),
    maxAnnotations: integer("max-annotations", 50, 0, 1000),
  };
  if (options.all && options.scope !== undefined)
    throw usage("all and scope are mutually exclusive.");
  if (command === "check" && options.failOnBudget)
    throw usage("fail-on-budget requires a stats command.");
  if (command === "stats" && options.strict) throw usage("strict requires a check command.");
  return options;
}

function usage(message: string): SyngrapheError {
  return new SyngrapheError(message, EXIT_USAGE);
}
