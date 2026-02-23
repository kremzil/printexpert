#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const DEFAULT_ENV_FILE = ".env.prod";
const DEFAULT_RETRIES = 3;

function printUsage() {
  console.log(`Usage:
  node scripts/db/migrate-prod.mjs status [--env-file .env.prod] [--retries 3]
  node scripts/db/migrate-prod.mjs deploy [--env-file .env.prod] [--retries 3]
`);
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const args = {
    command: null,
    envFile: DEFAULT_ENV_FILE,
    retries: DEFAULT_RETRIES,
  };

  const tokens = [...argv];
  const command = tokens.shift();
  if (command === "status" || command === "deploy") {
    args.command = command;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token === "--env-file" && tokens[i + 1]) {
      args.envFile = tokens[i + 1];
      i += 1;
      continue;
    }

    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length);
      continue;
    }

    if (token === "--retries" && tokens[i + 1]) {
      args.retries = Number(tokens[i + 1]);
      i += 1;
      continue;
    }

    if (token.startsWith("--retries=")) {
      args.retries = Number(token.slice("--retries=".length));
      continue;
    }

  }

  return args;
}

function resolveEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
  return resolved;
}

function loadEnv(filePath) {
  const resolved = resolveEnvFile(filePath);
  const result = dotenv.config({ path: resolved, override: true });
  if (result.error) {
    throw result.error;
  }

  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is required for Prisma Migrate.");
  }
}

function getPrismaExecutable() {
  const localPrismaPath = path.resolve(
    process.cwd(),
    process.platform === "win32" ? "node_modules/.bin/prisma.cmd" : "node_modules/.bin/prisma"
  );
  if (fs.existsSync(localPrismaPath)) {
    return { command: localPrismaPath, prependPrismaToken: false };
  }
  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    prependPrismaToken: true,
  };
}

function runPrismaCommand(prismaArgs) {
  const executable = getPrismaExecutable();
  const fullArgs = executable.prependPrismaToken ? ["prisma", ...prismaArgs] : prismaArgs;

  const result = spawnSync(executable.command, fullArgs, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error) {
    const message =
      result.error instanceof Error ? result.error.message : String(result.error ?? "unknown");
    return { status: 1, output: message };
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = `${stdout}\n${stderr}`;
  const status = typeof result.status === "number" ? result.status : 1;

  if (stdout.trim()) process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
  if (status !== 0 && !stdout.trim() && !stderr.trim() && output.trim()) {
    process.stderr.write(`${output}\n`);
  }

  return { status, output };
}

function isRetryableError(output) {
  const text = output.toLowerCase();
  return (
    text.includes("p1001") ||
    text.includes("p1002") ||
    text.includes("can't reach database server") ||
    text.includes("connection refused") ||
    text.includes("timeout expired") ||
    text.includes("timed out") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("server closed the connection unexpectedly")
  );
}

function maybePrintResolveHint(output) {
  const text = output.toLowerCase();
  const hasHistoryConflict =
    text.includes("p3008") ||
    text.includes("p3009") ||
    text.includes("p3018") ||
    text.includes("already recorded as applied") ||
    text.includes("failed migration");

  if (!hasHistoryConflict) return;

  const migrationMatch =
    output.match(/migration\s+`([^`]+)`/i) ||
    output.match(/migration\s+"([^"]+)"/i) ||
    output.match(/migration\s+([a-z0-9_]+)/i);
  const migrationName = migrationMatch?.[1] ?? "<migration_name>";

  console.error("\n[hint] Detected migration history conflict.");
  console.error("[hint] If SQL was already applied manually, reconcile history:");
  console.error(
    `[hint] npx prisma migrate resolve --applied ${migrationName} --schema prisma/schema.prisma`
  );
  console.error("[hint] Then run deploy again.");
}

function runWithRetry(prismaArgs, retries) {
  let attempt = 1;
  let last = { status: 1, output: "" };

  while (attempt <= retries) {
    if (attempt > 1) {
      console.log(`\nRetry ${attempt}/${retries}: prisma ${prismaArgs.join(" ")}`);
    }
    last = runPrismaCommand(prismaArgs);
    if (last.status === 0) return last;
    if (!isRetryableError(last.output) || attempt === retries) return last;

    const delaySec = attempt * 2;
    console.warn(`\nRetryable error detected. Waiting ${delaySec}s before retry...`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delaySec * 1000);
    attempt += 1;
  }

  return last;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command) {
    printUsage();
    process.exit(1);
  }

  if (!Number.isFinite(args.retries) || args.retries < 1) {
    throw new Error("--retries must be a positive integer.");
  }

  loadEnv(args.envFile);

  if (args.command === "status") {
    const result = runWithRetry(["migrate", "status", "--schema", "prisma/schema.prisma"], args.retries);
    if (result.status !== 0) {
      maybePrintResolveHint(result.output);
      process.exit(result.status);
    }
    return;
  }

  console.log("Step 1/3: Checking migration status...");
  const statusBefore = runWithRetry(
    ["migrate", "status", "--schema", "prisma/schema.prisma"],
    args.retries
  );
  if (statusBefore.status !== 0) {
    maybePrintResolveHint(statusBefore.output);
    process.exit(statusBefore.status);
  }

  console.log("\nStep 2/3: Applying pending migrations...");
  const deploy = runWithRetry(
    ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
    args.retries
  );
  if (deploy.status !== 0) {
    maybePrintResolveHint(deploy.output);
    process.exit(deploy.status);
  }

  console.log("\nStep 3/3: Verifying final status...");
  const statusAfter = runWithRetry(
    ["migrate", "status", "--schema", "prisma/schema.prisma"],
    args.retries
  );
  if (statusAfter.status !== 0) {
    maybePrintResolveHint(statusAfter.output);
    process.exit(statusAfter.status);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
