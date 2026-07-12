import { createRuntime } from "./runtime.js";

const runtime = createRuntime();
await runtime.fileSystem.initialize();
process.stdout.write("Schema version 1 requires no migrations. No files changed.\n");
