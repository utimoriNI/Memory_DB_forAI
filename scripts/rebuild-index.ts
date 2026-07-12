import { createRuntime } from "./runtime.js";
import { RoutingIndexService } from "../src/application/use-cases/refresh-routing-index.js";

const runtime = createRuntime();
const index = await runtime.index.rebuild();
await new RoutingIndexService(runtime.markdown, runtime.index).refresh();
process.stdout.write(`Indexed ${index.entries.length} memories at ${runtime.config.vaultPath}\n`);
