#!/usr/bin/env node
import { loadConfig } from "./config/env.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { runMemoryMcpServer } from "./mcp/server.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);

await runMemoryMcpServer(config, logger);
