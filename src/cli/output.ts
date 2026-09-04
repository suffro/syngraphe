/**
 * Output sink for commands.
 *
 * Commands never touch `console` directly: they write through this interface,
 * so tests can capture exactly what a command produces.
 */

export interface Output {
  write(text: string): void;
  writeError(text: string): void;
}

export const consoleOutput: Output = {
  write(text) {
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  },
  writeError(text) {
    process.stderr.write(text.endsWith("\n") ? text : `${text}\n`);
  },
};

export interface CapturedOutput extends Output {
  stdout: string;
  stderr: string;
}

/** An in-memory Output, used by tests. */
export function createCapturedOutput(): CapturedOutput {
  const captured: CapturedOutput = {
    stdout: "",
    stderr: "",
    write(text) {
      captured.stdout += text.endsWith("\n") ? text : `${text}\n`;
    },
    writeError(text) {
      captured.stderr += text.endsWith("\n") ? text : `${text}\n`;
    },
  };
  return captured;
}
