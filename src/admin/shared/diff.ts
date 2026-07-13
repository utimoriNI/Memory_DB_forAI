export function createWholeFileDiff(before: string, after: string, targetPath: string): string {
  if (before === after) return "No changes";
  const removed = before
    ? before
        .trimEnd()
        .split("\n")
        .map((line) => `-${line}`)
        .join("\n")
    : "";
  const added = after
    ? after
        .trimEnd()
        .split("\n")
        .map((line) => `+${line}`)
        .join("\n")
    : "";
  return [`--- a/${targetPath}`, `+++ b/${targetPath}`, removed, added].filter(Boolean).join("\n");
}
