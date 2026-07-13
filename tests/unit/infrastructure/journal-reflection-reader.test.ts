import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JournalReflectionReader } from "../../../src/infrastructure/journal/journal-reflection-reader.js";

describe("JournalReflectionReader", () => {
  it("reads daily reflections while excluding weekly and monthly summaries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "journal-reader-"));
    await mkdir(path.join(root, "reflection", "weekly"), { recursive: true });
    await mkdir(path.join(root, "reflection", "monthly"), { recursive: true });
    await writeFile(path.join(root, "reflection", "2026-07-13.md"), "Daily reflection", "utf8");
    await writeFile(path.join(root, "reflection", "weekly", "2026-W28.md"), "Weekly", "utf8");
    await writeFile(path.join(root, "reflection", "monthly", "2026-07.md"), "Monthly", "utf8");

    await expect(new JournalReflectionReader(root).list()).resolves.toEqual([
      { date: "2026-07-13", relativePath: "reflection/2026-07-13.md", content: "Daily reflection" }
    ]);
  });

  it("rejects a symlink that escapes the Journal root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "journal-reader-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "journal-outside-"));
    await mkdir(path.join(root, "reflection"), { recursive: true });
    await writeFile(path.join(outside, "2026-07-14.md"), "outside", "utf8");
    await symlink(
      path.join(outside, "2026-07-14.md"),
      path.join(root, "reflection", "2026-07-14.md")
    );

    await expect(new JournalReflectionReader(root).list(["2026-07-14"])).rejects.toThrow(
      /symlink|root/
    );
  });
});
