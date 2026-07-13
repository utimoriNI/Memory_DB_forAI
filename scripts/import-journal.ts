import { createRuntime } from "./runtime.js";
import { JournalImportService } from "../src/application/use-cases/journal-import.js";
import { MemoryLifecycleService } from "../src/application/use-cases/memory-lifecycle.js";
import { JournalReflectionReader } from "../src/infrastructure/journal/journal-reflection-reader.js";

interface Options {
  journalRoot: string;
  memoryVault?: string;
  dates?: string[];
  all: boolean;
}

function parseOptions(argv: string[]): Options {
  let journalRoot = process.env.JOURNAL_REPO_PATH ?? "";
  let memoryVault = process.env.MEMORY_VAULT_PATH;
  const dates: string[] = [];
  let all = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--journal-root") journalRoot = argv[++index] ?? "";
    else if (argument === "--memory-vault") memoryVault = argv[++index];
    else if (argument === "--date") dates.push(argv[++index] ?? "");
    else if (argument === "--all") all = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!journalRoot) {
    throw new Error("JOURNAL_REPO_PATH or --journal-root is required");
  }
  if (dates.length > 0 && all) {
    throw new Error("Use --date or --all, not both");
  }
  return {
    journalRoot,
    ...(memoryVault ? { memoryVault } : {}),
    ...(dates.length ? { dates } : {}),
    all
  };
}

function previousJstDate(): string {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const previous = new Date(`${today}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

const options = parseOptions(process.argv.slice(2));
if (options.memoryVault) process.env.MEMORY_VAULT_PATH = options.memoryVault;

const dates = options.all ? undefined : (options.dates ?? [previousJstDate()]);
const reader = new JournalReflectionReader(options.journalRoot);
const reflections = await reader.list(dates);
const runtime = createRuntime();
await runtime.fileSystem.initialize();
const lifecycle = new MemoryLifecycleService(runtime.markdown, runtime.index);
const importer = new JournalImportService(lifecycle);
const results: Array<{ path: string; date: string; source: string }> = [];

for (const reflection of reflections) {
  const result = await importer.importEntry({
    entryId: `journal-${reflection.date}`,
    version: 1,
    recordedAt: `${reflection.date}T00:00:00+09:00`,
    journalPath: reflection.relativePath,
    summary: reflection.content,
    topics: ["journal", "reflection"]
  });
  results.push({ path: result.path, date: reflection.date, source: result.source });
}

process.stdout.write(
  `${JSON.stringify({ imported: results.length, dates: results.map((result) => result.date), results })}\n`
);
