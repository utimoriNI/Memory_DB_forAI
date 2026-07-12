import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createLogger } from "../../src/infrastructure/logging/logger.js";
import { createMemoryMcpServer } from "../../src/mcp/server.js";

describe("MCP server", () => {
  it("registers tools and serves the initialized index", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mcp-vault-"));
    const server = await createMemoryMcpServer(
      {
        vaultPath: root,
        logLevel: "silent",
        pinnedMemoryWarningLimit: 20,
        maxContextFiles: 20,
        maxContextCharacters: 50_000
      },
      createLogger("silent")
    );
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "memory_read_index",
        "staging_approve",
        "obsidian_search",
        "raindrop_search"
      ])
    );
    expect(tools.tools).toHaveLength(23);
    const result = await client.callTool({ name: "memory_read_index", arguments: {} });
    expect(JSON.stringify(result.content)).toContain("AI Memory Vault");
    await client.close();
    await server.close();
  });
});
