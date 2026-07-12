import { VaultInitializer } from "../src/application/use-cases/initialize-vault.js";
import { createRuntime } from "./runtime.js";

const runtime = createRuntime();
await new VaultInitializer(runtime.markdown, runtime.index).initialize();
process.stdout.write(`Initialized Vault at ${runtime.config.vaultPath}\n`);
