#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;
const CONFIRM_TOKEN = "I_UNDERSTAND_PROD_OVERWRITE";
const DEFAULT_PLAN = "scripts/db/sync-plan.json";
const BUILTIN_PROTECTED_TABLES = ["Order*", "StripeEvent", "NotificationLog"];
const VALID_MODES = new Set(["skip", "append", "upsert"]);
const VALID_CONFLICTS = new Set(["prod_wins", "local_wins", "error_on_conflict"]);
const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function printUsage() {
  console.log(`Usage:
  node scripts/db/sync-data.mjs --from-env .env --to-env .env.production --plan ${DEFAULT_PLAN} --dry-run
  node scripts/db/sync-data.mjs --from-env .env --to-env .env.production --plan ${DEFAULT_PLAN} --apply

Optional:
  --allow-protected-overwrite
  --confirm-overwrite ${CONFIRM_TOKEN}
`);
}

function parseArgs(argv) {
  const args = {
    fromEnv: null,
    toEnv: null,
    plan: DEFAULT_PLAN,
    dryRun: true,
    apply: false,
    allowProtectedOverwrite: false,
    confirmOverwrite: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--from-env" && argv[i + 1]) {
      args.fromEnv = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--from-env=")) {
      args.fromEnv = token.slice("--from-env=".length);
      continue;
    }

    if (token === "--to-env" && argv[i + 1]) {
      args.toEnv = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--to-env=")) {
      args.toEnv = token.slice("--to-env=".length);
      continue;
    }

    if (token === "--plan" && argv[i + 1]) {
      args.plan = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--plan=")) {
      args.plan = token.slice("--plan=".length);
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
      continue;
    }
    if (token === "--apply") {
      args.dryRun = false;
      args.apply = true;
      continue;
    }

    if (token === "--allow-protected-overwrite") {
      args.allowProtectedOverwrite = true;
      continue;
    }

    if (token === "--confirm-overwrite" && argv[i + 1]) {
      args.confirmOverwrite = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--confirm-overwrite=")) {
      args.confirmOverwrite = token.slice("--confirm-overwrite=".length);
      continue;
    }

    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  if (!args.fromEnv || !args.toEnv) {
    throw new Error("--from-env and --to-env are required.");
  }

  return args;
}

function readEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
  const parsed = dotenv.parse(fs.readFileSync(resolved, "utf8"));
  return parsed;
}

function getConnectionString(env, label) {
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(`${label}: expected DIRECT_URL or DATABASE_URL in env file.`);
  }
  return connectionString;
}

function readPlan(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Sync plan not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  const plan = JSON.parse(raw);
  return plan;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function validateIdentifier(identifier, label) {
  if (!IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Invalid identifier for ${label}: ${identifier}`);
  }
}

function parseQualifiedTableName(rawName) {
  const parts = rawName.split(".");
  if (parts.length === 1) {
    validateIdentifier(parts[0], "table");
    return { schema: "public", table: parts[0] };
  }
  if (parts.length === 2) {
    validateIdentifier(parts[0], "schema");
    validateIdentifier(parts[1], "table");
    return { schema: parts[0], table: parts[1] };
  }
  throw new Error(`Invalid table name: ${rawName}`);
}

function quoteIdent(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteQualifiedTableName(tableName) {
  const { schema, table } = parseQualifiedTableName(tableName);
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

function joinColumns(columns, prefix = "") {
  return columns.map((column) => `${prefix}${quoteIdent(column)}`).join(", ");
}

function keyJoinCondition(keyColumns, leftAlias, rightAlias) {
  return keyColumns
    .map((column) => `${leftAlias}.${quoteIdent(column)} = ${rightAlias}.${quoteIdent(column)}`)
    .join(" AND ");
}

function tableMatchesPattern(tableName, pattern) {
  if (!pattern.includes("*")) return tableName.toLowerCase() === pattern.toLowerCase();
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(tableName);
}

async function getColumns(client, tableName) {
  const { schema, table } = parseQualifiedTableName(tableName);
  const result = await client.query(
    `
      SELECT
        column_name,
        is_generated,
        identity_generation,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [schema, table]
  );
  return result.rows.map((row) => ({
    name: row.column_name,
    isGenerated: row.is_generated !== "NEVER",
    isIdentity: row.identity_generation !== null,
    udtName: row.udt_name,
  }));
}

async function getPrimaryKeyColumns(client, tableName) {
  const { schema, table } = parseQualifiedTableName(tableName);
  const result = await client.query(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE i.indisprimary
        AND n.nspname = $1
        AND c.relname = $2
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    [schema, table]
  );
  return result.rows.map((row) => row.column_name);
}

function resolveSelectedColumns({ sourceColumns, targetColumns, configuredColumns }) {
  const sourceSet = new Set(sourceColumns.map((column) => column.name));
  const targetByName = new Map(targetColumns.map((column) => [column.name, column]));

  if (configuredColumns?.length) {
    for (const column of configuredColumns) {
      validateIdentifier(column, "column");
      if (!sourceSet.has(column)) {
        throw new Error(`Configured column '${column}' does not exist in source table.`);
      }
      if (!targetByName.has(column)) {
        throw new Error(`Configured column '${column}' does not exist in target table.`);
      }
    }
    return configuredColumns;
  }

  const selected = [];
  for (const sourceColumn of sourceColumns) {
    const targetColumn = targetByName.get(sourceColumn.name);
    if (!targetColumn) continue;
    if (targetColumn.isGenerated || targetColumn.isIdentity) continue;
    selected.push(sourceColumn.name);
  }
  return selected;
}

function resolveProtectedTables(plan) {
  const fromPlan = ensureArray(plan.protectedTables, []);
  const combined = [...new Set([...BUILTIN_PROTECTED_TABLES, ...fromPlan])];
  return combined;
}

async function fetchSourceRows(client, tableName, columns, whereClause) {
  const tableSql = quoteQualifiedTableName(tableName);
  const columnsSql = joinColumns(columns);
  const whereSql = whereClause ? ` WHERE ${whereClause}` : "";
  const query = `SELECT ${columnsSql} FROM ${tableSql}${whereSql}`;
  const result = await client.query(query);
  return result.rows;
}

function normalizeParamValue(value, columnDef) {
  if (value === undefined || value === null) return null;
  if (columnDef.udtName === "json" || columnDef.udtName === "jsonb") {
    return JSON.stringify(value);
  }
  return value;
}

async function insertRowsIntoStage(client, stageTable, columns, columnDefMap, rows) {
  const batchSize = 200;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const row of batch) {
      const rowPlaceholders = [];
      for (const column of columns) {
        const columnDef = columnDefMap.get(column);
        values.push(normalizeParamValue(row[column], columnDef));
        rowPlaceholders.push(`$${paramIndex}`);
        paramIndex += 1;
      }
      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${stageTable} (${joinColumns(columns)}) VALUES ${placeholders.join(", ")}`;
    const result = await client.query(sql, values);
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function calculateCounts(client, targetTableSql, stageTableSql, keyColumns) {
  const keyCondition = keyJoinCondition(keyColumns, "s", "t");
  const firstKey = keyColumns[0];
  const missingPredicate = `t.${quoteIdent(firstKey)} IS NULL`;

  const sourceRowsQuery = `SELECT COUNT(*)::int AS c FROM ${stageTableSql}`;
  const conflictsQuery = `
    SELECT COUNT(*)::int AS c
    FROM ${stageTableSql} s
    JOIN ${targetTableSql} t
      ON ${keyCondition}
  `;
  const toInsertQuery = `
    SELECT COUNT(*)::int AS c
    FROM ${stageTableSql} s
    LEFT JOIN ${targetTableSql} t
      ON ${keyCondition}
    WHERE ${missingPredicate}
  `;
  const duplicateKeyQuery = `
    SELECT COUNT(*)::int AS c
    FROM (
      SELECT ${joinColumns(keyColumns)}
      FROM ${stageTableSql}
      GROUP BY ${joinColumns(keyColumns)}
      HAVING COUNT(*) > 1
    ) duplicates
  `;

  const [sourceRows, conflicts, toInsert, duplicateKeyGroups] = await Promise.all([
    client.query(sourceRowsQuery),
    client.query(conflictsQuery),
    client.query(toInsertQuery),
    client.query(duplicateKeyQuery),
  ]);

  return {
    sourceRows: sourceRows.rows[0].c,
    conflicts: conflicts.rows[0].c,
    toInsert: toInsert.rows[0].c,
    duplicateKeyGroups: duplicateKeyGroups.rows[0].c,
  };
}

async function applyAppend(client, targetTableSql, stageTableSql, columns, keyColumns) {
  const keyCondition = keyJoinCondition(keyColumns, "s", "t");
  const firstKey = keyColumns[0];
  const missingPredicate = `t.${quoteIdent(firstKey)} IS NULL`;
  const sql = `
    INSERT INTO ${targetTableSql} (${joinColumns(columns)})
    SELECT ${joinColumns(columns, "s.")}
    FROM ${stageTableSql} s
    LEFT JOIN ${targetTableSql} t
      ON ${keyCondition}
    WHERE ${missingPredicate}
  `;
  const result = await client.query(sql);
  return { inserted: result.rowCount ?? 0, updated: 0 };
}

async function applyLocalWins({
  client,
  targetTableSql,
  stageTableSql,
  columns,
  keyColumns,
  immutableColumns,
}) {
  const keyCondition = keyJoinCondition(keyColumns, "s", "t");
  const mutableColumns = columns.filter(
    (column) => !keyColumns.includes(column) && !immutableColumns.includes(column)
  );

  let updated = 0;
  if (mutableColumns.length > 0) {
    const assignments = mutableColumns
      .map((column) => `${quoteIdent(column)} = s.${quoteIdent(column)}`)
      .join(", ");
    const updateSql = `
      UPDATE ${targetTableSql} t
      SET ${assignments}
      FROM ${stageTableSql} s
      WHERE ${keyCondition}
    `;
    const updateResult = await client.query(updateSql);
    updated = updateResult.rowCount ?? 0;
  }

  const appendResult = await applyAppend(client, targetTableSql, stageTableSql, columns, keyColumns);
  return { inserted: appendResult.inserted, updated };
}

function normalizeTableConfig(tableConfig, defaults) {
  const mode = tableConfig.mode ?? defaults.mode ?? "skip";
  const onConflict = tableConfig.onConflict ?? defaults.onConflict ?? "prod_wins";

  if (!VALID_MODES.has(mode)) {
    throw new Error(`Invalid mode '${mode}' for table '${tableConfig.name}'.`);
  }
  if (!VALID_CONFLICTS.has(onConflict)) {
    throw new Error(`Invalid onConflict '${onConflict}' for table '${tableConfig.name}'.`);
  }
  return { mode, onConflict };
}

function ensureProtectedAllowed({
  tableName,
  mode,
  onConflict,
  protectedPatterns,
  allowProtectedOverwrite,
  confirmOverwrite,
}) {
  const isProtected = protectedPatterns.some((pattern) => tableMatchesPattern(tableName, pattern));
  const isOverwrite = mode === "upsert" && onConflict === "local_wins";
  if (!isProtected || !isOverwrite) return;

  if (!allowProtectedOverwrite) {
    throw new Error(
      `Table '${tableName}' is protected. Re-run with --allow-protected-overwrite and --confirm-overwrite ${CONFIRM_TOKEN}`
    );
  }
  if (confirmOverwrite !== CONFIRM_TOKEN) {
    throw new Error(
      `Table '${tableName}' is protected. Invalid confirmation token. Expected '${CONFIRM_TOKEN}'.`
    );
  }
}

async function processTable({
  sourceClient,
  targetClient,
  tableConfig,
  defaults,
  dryRun,
  protectedPatterns,
  allowProtectedOverwrite,
  confirmOverwrite,
}) {
  const tableName = tableConfig.name;
  if (!tableName) {
    throw new Error("Each table config must include 'name'.");
  }

  const { mode, onConflict } = normalizeTableConfig(tableConfig, defaults);
  const keyColumns = ensureArray(tableConfig.key, []);

  for (const key of keyColumns) {
    validateIdentifier(key, `key column of ${tableName}`);
  }

  if (mode !== "skip" && keyColumns.length === 0) {
    throw new Error(`Table '${tableName}' must define non-empty key[].`);
  }

  ensureProtectedAllowed({
    tableName,
    mode,
    onConflict,
    protectedPatterns,
    allowProtectedOverwrite,
    confirmOverwrite,
  });

  const result = {
    table: tableName,
    mode,
    onConflict,
    sourceRows: 0,
    toInsert: 0,
    toUpdate: 0,
    conflicts: 0,
    duplicateSourceKeyGroups: 0,
    appliedInserts: 0,
    appliedUpdates: 0,
    skipped: false,
    reason: "",
  };

  if (mode === "skip") {
    result.skipped = true;
    result.reason = "mode=skip";
    return result;
  }

  const sourceColumns = await getColumns(sourceClient, tableName);
  const targetColumns = await getColumns(targetClient, tableName);
  if (sourceColumns.length === 0) {
    throw new Error(`Source table '${tableName}' does not exist or has no columns.`);
  }
  if (targetColumns.length === 0) {
    throw new Error(`Target table '${tableName}' does not exist or has no columns.`);
  }

  const selectedColumns = resolveSelectedColumns({
    sourceColumns,
    targetColumns,
    configuredColumns: ensureArray(tableConfig.columns, null),
  });
  if (selectedColumns.length === 0) {
    throw new Error(`Table '${tableName}' has no selectable columns for sync.`);
  }

  for (const keyColumn of keyColumns) {
    if (!selectedColumns.includes(keyColumn)) {
      throw new Error(`Table '${tableName}' key column '${keyColumn}' is missing in selected columns.`);
    }
  }

  const primaryKeyColumns = await getPrimaryKeyColumns(targetClient, tableName);
  const immutableColumns = [...new Set(primaryKeyColumns)];
  const selectedColumnDefMap = new Map(
    selectedColumns.map((columnName) => {
      const metadata = targetColumns.find((column) => column.name === columnName);
      if (!metadata) {
        throw new Error(`Column metadata not found for ${tableName}.${columnName}`);
      }
      return [columnName, metadata];
    })
  );

  const sourceRows = await fetchSourceRows(
    sourceClient,
    tableName,
    selectedColumns,
    tableConfig.where || ""
  );
  result.sourceRows = sourceRows.length;
  if (sourceRows.length === 0) {
    result.skipped = true;
    result.reason = "no source rows";
    return result;
  }

  const { table } = parseQualifiedTableName(tableName);
  const stageName = `__sync_stage_${table.toLowerCase()}`;
  const stageSql = quoteIdent(stageName);
  const targetTableSql = quoteQualifiedTableName(tableName);

  await targetClient.query("BEGIN");
  try {
    await targetClient.query(`DROP TABLE IF EXISTS ${stageSql}`);

    const createStageSql = `
      CREATE TEMP TABLE ${stageSql}
      AS SELECT ${joinColumns(selectedColumns)}
      FROM ${targetTableSql}
      WHERE FALSE
    `;
    await targetClient.query(createStageSql);

    await insertRowsIntoStage(
      targetClient,
      stageSql,
      selectedColumns,
      selectedColumnDefMap,
      sourceRows
    );

    const counts = await calculateCounts(targetClient, targetTableSql, stageSql, keyColumns);
    result.sourceRows = counts.sourceRows;
    result.conflicts = counts.conflicts;
    result.toInsert = counts.toInsert;
    result.duplicateSourceKeyGroups = counts.duplicateKeyGroups;
    if (mode === "upsert" && onConflict === "local_wins") {
      result.toUpdate = counts.conflicts;
    }

    if (counts.duplicateKeyGroups > 0) {
      throw new Error(
        `Table '${tableName}' has duplicate key groups in source data (${counts.duplicateKeyGroups}).`
      );
    }

    if (mode === "upsert" && onConflict === "error_on_conflict" && counts.conflicts > 0) {
      throw new Error(
        `Table '${tableName}' has ${counts.conflicts} conflicting rows and onConflict=error_on_conflict.`
      );
    }

    if (!dryRun) {
      if (mode === "append" || (mode === "upsert" && onConflict !== "local_wins")) {
        const applied = await applyAppend(
          targetClient,
          targetTableSql,
          stageSql,
          selectedColumns,
          keyColumns
        );
        result.appliedInserts = applied.inserted;
      } else if (mode === "upsert" && onConflict === "local_wins") {
        const applied = await applyLocalWins({
          client: targetClient,
          targetTableSql,
          stageTableSql: stageSql,
          columns: selectedColumns,
          keyColumns,
          immutableColumns,
        });
        result.appliedInserts = applied.inserted;
        result.appliedUpdates = applied.updated;
      }
    }

    if (dryRun) {
      await targetClient.query("ROLLBACK");
    } else {
      await targetClient.query("COMMIT");
    }
  } catch (error) {
    await targetClient.query("ROLLBACK");
    throw error;
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = readPlan(args.plan);

  const defaults = {
    mode: plan?.defaults?.mode ?? "skip",
    onConflict: plan?.defaults?.onConflict ?? "prod_wins",
  };
  if (!VALID_MODES.has(defaults.mode)) {
    throw new Error(`Invalid defaults.mode '${defaults.mode}'.`);
  }
  if (!VALID_CONFLICTS.has(defaults.onConflict)) {
    throw new Error(`Invalid defaults.onConflict '${defaults.onConflict}'.`);
  }

  const tableConfigs = ensureArray(plan.tables, []);
  if (tableConfigs.length === 0) {
    throw new Error("Sync plan has no tables. Add at least one table config.");
  }

  const sourceEnv = readEnvFile(args.fromEnv);
  const targetEnv = readEnvFile(args.toEnv);
  const sourceConnectionString = getConnectionString(sourceEnv, "from-env");
  const targetConnectionString = getConnectionString(targetEnv, "to-env");

  const protectedPatterns = resolveProtectedTables(plan);

  const sourceClient = new Client({ connectionString: sourceConnectionString });
  const targetClient = new Client({ connectionString: targetConnectionString });
  await sourceClient.connect();
  await targetClient.connect();

  const results = [];
  const startedAt = Date.now();
  try {
    for (const tableConfig of tableConfigs) {
      console.log(
        `\n[table] ${tableConfig.name} (mode=${tableConfig.mode ?? defaults.mode}, onConflict=${tableConfig.onConflict ?? defaults.onConflict})`
      );
      const tableResult = await processTable({
        sourceClient,
        targetClient,
        tableConfig,
        defaults,
        dryRun: args.dryRun,
        protectedPatterns,
        allowProtectedOverwrite: args.allowProtectedOverwrite,
        confirmOverwrite: args.confirmOverwrite,
      });
      results.push(tableResult);
      console.log(
        `[table] source=${tableResult.sourceRows}, toInsert=${tableResult.toInsert}, toUpdate=${tableResult.toUpdate}, conflicts=${tableResult.conflicts}, appliedInserts=${tableResult.appliedInserts}, appliedUpdates=${tableResult.appliedUpdates}${tableResult.skipped ? `, skipped=${tableResult.reason}` : ""}`
      );
    }
  } finally {
    await sourceClient.end().catch(() => {});
    await targetClient.end().catch(() => {});
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    mode: args.dryRun ? "dry-run" : "apply",
    plan: path.resolve(process.cwd(), args.plan),
    protectedPatterns,
    totals: {
      tables: results.length,
      sourceRows: results.reduce((sum, item) => sum + item.sourceRows, 0),
      toInsert: results.reduce((sum, item) => sum + item.toInsert, 0),
      toUpdate: results.reduce((sum, item) => sum + item.toUpdate, 0),
      conflicts: results.reduce((sum, item) => sum + item.conflicts, 0),
      appliedInserts: results.reduce((sum, item) => sum + item.appliedInserts, 0),
      appliedUpdates: results.reduce((sum, item) => sum + item.appliedUpdates, 0),
      skippedTables: results.filter((item) => item.skipped).length,
    },
    durationMs,
    tables: results,
  };

  console.log("\n=== Sync Summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
