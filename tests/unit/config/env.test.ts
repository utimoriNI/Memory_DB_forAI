import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../src/config/env.js";

describe("loadConfig", () => {
  it("loads safe defaults", () => {
    const config = loadConfig({ MEMORY_VAULT_PATH: "./fixtures/vault" });

    expect(config.vaultPath).toMatch(/fixtures\/vault$/);
    expect(config.maxContextCharacters).toBe(50_000);
    expect(config.pinnedMemoryWarningLimit).toBe(20);
  });

  it("rejects invalid limits", () => {
    expect(() => loadConfig({ MEMORY_VAULT_PATH: "./memory", MAX_CONTEXT_FILES: "0" })).toThrow();
  });
});
