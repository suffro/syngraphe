/**
 * Text helpers shared by every module that rewrites user-authored files.
 *
 * Syngraphe edits files people also edit by hand, so the line ending style and
 * the presence of a final newline are treated as part of the file and restored
 * after any transformation.
 */

export type LineEnding = "\n" | "\r\n";

export interface TextShape {
  lineEnding: LineEnding;
  finalNewline: boolean;
}

/** The dominant line ending of `text`; LF when the text has no CR at all. */
export function detectLineEnding(text: string): LineEnding {
  const crlf = text.split("\r\n").length - 1;
  if (crlf === 0) return "\n";
  const lf = text.split("\n").length - 1;
  // CRLF wins ties: mixed files are normalized towards the dominant style.
  return crlf >= lf - crlf ? "\r\n" : "\n";
}

export function detectTextShape(text: string): TextShape {
  return {
    lineEnding: detectLineEnding(text),
    finalNewline: text.length === 0 || text.endsWith("\n"),
  };
}

/** Convert CRLF/CR to LF so transformations only ever deal with one style. */
export function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Re-apply the original line ending style and final newline to LF text. */
export function fromLf(text: string, shape: TextShape): string {
  let out = text;
  if (shape.finalNewline) {
    if (!out.endsWith("\n")) out += "\n";
  } else if (out.endsWith("\n")) {
    out = out.slice(0, -1);
  }
  return shape.lineEnding === "\r\n" ? out.replace(/\n/g, "\r\n") : out;
}

/** Split LF text into lines without producing a trailing empty element. */
export function splitLines(lfText: string): string[] {
  if (lfText === "") return [];
  const lines = lfText.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function joinLines(lines: string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
