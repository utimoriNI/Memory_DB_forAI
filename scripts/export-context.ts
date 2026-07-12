import { ContextBuilder, type ContextPurpose } from "../src/application/use-cases/build-context.js";
import { createRuntime } from "./runtime.js";

const runtime = createRuntime();
const purpose = (process.argv[2] ?? "general") as ContextPurpose;
const query = process.argv[3];
const project = process.argv[4];
const builder = new ContextBuilder(runtime.markdown, runtime.search);
const context = await builder.build({
  purpose,
  ...(query ? { query } : {}),
  ...(project ? { project } : {}),
  maxFiles: runtime.config.maxContextFiles,
  maxCharacters: runtime.config.maxContextCharacters
});
process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
