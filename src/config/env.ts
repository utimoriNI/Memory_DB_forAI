import path from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  MEMORY_VAULT_PATH: z.string().min(1).default("./memory"),
  OBSIDIAN_VAULT_PATH: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PINNED_MEMORY_WARNING_LIMIT: z.coerce.number().int().positive().default(20),
  MAX_CONTEXT_FILES: z.coerce.number().int().positive().default(20),
  MAX_CONTEXT_CHARACTERS: z.coerce.number().int().positive().default(50_000)
});

export type AppConfig = Readonly<{
  vaultPath: string;
  obsidianVaultPath?: string;
  logLevel: z.infer<typeof environmentSchema>["LOG_LEVEL"];
  pinnedMemoryWarningLimit: number;
  maxContextFiles: number;
  maxContextCharacters: number;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    vaultPath: path.resolve(parsed.MEMORY_VAULT_PATH),
    ...(parsed.OBSIDIAN_VAULT_PATH
      ? { obsidianVaultPath: path.resolve(parsed.OBSIDIAN_VAULT_PATH) }
      : {}),
    logLevel: parsed.LOG_LEVEL,
    pinnedMemoryWarningLimit: parsed.PINNED_MEMORY_WARNING_LIMIT,
    maxContextFiles: parsed.MAX_CONTEXT_FILES,
    maxContextCharacters: parsed.MAX_CONTEXT_CHARACTERS
  };
}
