import { validateVault } from "../src/application/use-cases/validate-vault.js";
import { createRuntime } from "./runtime.js";

const runtime = createRuntime();
const report = await validateVault(runtime.markdown, runtime.config.pinnedMemoryWarningLimit);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;
