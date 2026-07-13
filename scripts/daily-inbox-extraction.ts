import { runDailyInboxExtraction } from "../src/application/use-cases/daily-inbox-extraction.js";
import { createRuntime } from "./runtime.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required for daily Inbox extraction");

const runtime = createRuntime();
const result = await runDailyInboxExtraction({
  markdown: runtime.markdown,
  index: runtime.index,
  apiKey,
  model: process.env.MEMORY_DAILY_OPENAI_MODEL
});
process.stdout.write(`${JSON.stringify(result)}\n`);
