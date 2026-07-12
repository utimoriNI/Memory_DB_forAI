import { loadConfig } from "../src/config/env.js";
import { VaultFileSystem } from "../src/infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../src/infrastructure/index/index-repository.js";
import { MarkdownSearchProvider } from "../src/infrastructure/index/markdown-search-provider.js";
import { MarkdownRepository } from "../src/infrastructure/markdown/markdown-repository.js";

export function createRuntime() {
  const config = loadConfig();
  const fileSystem = new VaultFileSystem(config.vaultPath);
  const markdown = new MarkdownRepository(fileSystem);
  const index = new IndexRepository(markdown);
  const search = new MarkdownSearchProvider(index, markdown);
  return { config, fileSystem, markdown, index, search };
}
