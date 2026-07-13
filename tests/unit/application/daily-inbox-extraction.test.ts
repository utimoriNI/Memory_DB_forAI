import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runDailyInboxExtraction } from "../../../src/application/use-cases/daily-inbox-extraction.js";
import { MemoryLifecycleService } from "../../../src/application/use-cases/memory-lifecycle.js";
import { VaultInitializer } from "../../../src/application/use-cases/initialize-vault.js";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../../../src/infrastructure/index/index-repository.js";
import { MarkdownRepository } from "../../../src/infrastructure/markdown/markdown-repository.js";

describe("daily Inbox extraction", () => {
  let markdown: MarkdownRepository;
  let index: IndexRepository;
  let inboxPath: string;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "daily-inbox-extraction-"));
    const fileSystem = new VaultFileSystem(root);
    markdown = new MarkdownRepository(fileSystem);
    index = new IndexRepository(markdown);
    const now = new Date("2026-07-13T00:00:00.000Z");
    await new VaultInitializer(markdown, index).initialize(now);
    inboxPath = await new MemoryLifecycleService(markdown, index).addInbox({
      title: "Markdown source of truth",
      content:
        "Keep the Markdown Vault as the source of truth so it remains portable and reviewable.",
      source: "test:daily-extraction",
      now
    });
  });

  it("creates a staged knowledge proposal once and records the processed Inbox hash", async () => {
    let requests = 0;
    const fetchMock: typeof fetch = () => {
      requests += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              items: [
                {
                  sourcePath: inboxPath,
                  action: "propose",
                  reason: "Portable storage is a reusable system design principle.",
                  summary: "Markdown source files keep the Vault portable and reviewable",
                  topics: ["memory", "markdown"],
                  body: "Use Markdown source files so the Vault remains portable and reviewable.",
                  confidence: 0.9,
                  importance: "medium"
                }
              ]
            })
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    };
    const input = {
      markdown,
      index,
      apiKey: "not-a-real-key",
      fetch: fetchMock,
      now: new Date("2026-07-13T01:00:00.000Z")
    };

    const first = await runDailyInboxExtraction(input);
    expect(first.proposed).toHaveLength(1);
    expect(await markdown.fileSystem.exists(first.proposed[0]?.proposalPath ?? "")).toBe(true);
    expect(await markdown.fileSystem.readText("_state/daily-inbox-extraction.json")).toContain(
      inboxPath
    );

    const second = await runDailyInboxExtraction(input);
    expect(second).toMatchObject({ examined: 0, proposed: [] });
    expect(requests).toBe(1);
  });

  it("does not send suspected secrets to the model", async () => {
    await markdown.writeSystemDocument(
      "_inbox/secret.md",
      "---\ntitle: Secret\nsource: [test]\nstatus: inbox\n---\n\napi_key: should-not-leave-the-vault\n"
    );
    const requests: string[] = [];
    const fetchMock: typeof fetch = (_input, init) => {
      if (typeof init?.body === "string") requests.push(init.body);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              items: [{ sourcePath: inboxPath, action: "skip", reason: "Not durable enough." }]
            })
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    };

    const result = await runDailyInboxExtraction({
      markdown,
      index,
      apiKey: "not-a-real-key",
      fetch: fetchMock,
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    expect(
      result.skipped.some(
        (entry) =>
          entry.sourcePath === "_inbox/secret.md" && entry.reason.includes("Potential secret")
      )
    ).toBe(true);
    expect(requests.join("\n")).not.toContain("should-not-leave-the-vault");
  });
});
