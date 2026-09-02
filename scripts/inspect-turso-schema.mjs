import { createClient } from "@libsql/client";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyNetlifyMigrations } from "./netlify-migrations.mjs";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) {
  throw new Error("Turso schema inspection credentials are not configured.");
}

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const normalize = (value) => String(value ?? "")
  .replaceAll(/[\s`"\[\]]+/g, "")
  .toLowerCase();

function extractConstraints(sql) {
  const normalized = normalize(sql);
  return [...normalized.matchAll(/(?:check|foreignkey|unique)\([^)]*\)/g)]
    .map(([value]) => value)
    .sort();
}

async function schemaSnapshot(client) {
  const schema = await client.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
  );
  const tables = schema.rows
    .filter((row) => row.type === "table")
    .map((row) => String(row.name));
  const tableSql = new Map(
    schema.rows
      .filter((row) => row.type === "table")
      .map((row) => [String(row.name), String(row.sql ?? "")]),
  );
  const indexes = schema.rows
    .filter((row) => row.type === "index")
    .map((row) => ({
      name: String(row.name),
      table: String(row.tbl_name),
      sql: normalize(row.sql),
    }));
  const details = {};

  for (const table of tables) {
    const escaped = quoteIdentifier(table);
    const [columnsResult, foreignKeysResult] = await Promise.all([
      client.execute(`PRAGMA table_info(${escaped})`),
      client.execute(`PRAGMA foreign_key_list(${escaped})`),
    ]);
    details[table] = {
      columns: columnsResult.rows.map((row) => ({
        name: String(row.name),
        type: normalize(row.type),
        notNull: Number(row.notnull),
        defaultValue: normalize(row.dflt_value),
        primaryKeyOrder: Number(row.pk),
      })),
      foreignKeys: foreignKeysResult.rows.map((row) => ({
        from: String(row.from),
        table: String(row.table),
        to: String(row.to),
        onUpdate: String(row.on_update),
        onDelete: String(row.on_delete),
      })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      constraints: extractConstraints(tableSql.get(table)),
    };
  }

  return {
    tables: tables.sort(),
    indexes: indexes.sort((left, right) => left.name.localeCompare(right.name)),
    details,
  };
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "mhji-schema-inspection-"));
const expectedClient = createClient({
  url: pathToFileURL(path.join(temporaryDirectory, "expected.sqlite")).href,
});
const productionClient = createClient({ url, authToken });

try {
  await applyNetlifyMigrations(expectedClient);
  const [expected, production] = await Promise.all([
    schemaSnapshot(expectedClient),
    schemaSnapshot(productionClient),
  ]);
  const expectedTables = new Set(expected.tables);
  const productionTables = new Set(production.tables);
  const expectedIndexes = new Map(expected.indexes.map((index) => [index.name, index]));
  const productionIndexes = new Map(production.indexes.map((index) => [index.name, index]));
  const missingTables = expected.tables.filter((name) => !productionTables.has(name));
  const extraTables = production.tables.filter((name) => !expectedTables.has(name));
  const missingIndexes = expected.indexes
    .map((index) => index.name)
    .filter((name) => !productionIndexes.has(name));
  const extraIndexes = production.indexes
    .map((index) => index.name)
    .filter((name) => !expectedIndexes.has(name));
  const changedTables = expected.tables
    .filter((name) => productionTables.has(name))
    .filter((name) => JSON.stringify(expected.details[name]) !== JSON.stringify(production.details[name]));
  const changedTableDetails = Object.fromEntries(changedTables.map((name) => {
    const expectedColumns = new Map(expected.details[name].columns.map((column) => [column.name, column]));
    const productionColumns = new Map(production.details[name].columns.map((column) => [column.name, column]));
    return [name, {
      missingColumns: [...expectedColumns.keys()].filter((column) => !productionColumns.has(column)),
      extraColumns: [...productionColumns.keys()].filter((column) => !expectedColumns.has(column)),
      changedColumns: [...expectedColumns.keys()]
        .filter((column) => productionColumns.has(column))
        .filter((column) => JSON.stringify(expectedColumns.get(column)) !== JSON.stringify(productionColumns.get(column))),
      foreignKeysMatch: JSON.stringify(expected.details[name].foreignKeys)
        === JSON.stringify(production.details[name].foreignKeys),
      constraintsMatch: JSON.stringify(expected.details[name].constraints)
        === JSON.stringify(production.details[name].constraints),
    }];
  }));
  const changedIndexes = expected.indexes
    .filter((index) => productionIndexes.has(index.name))
    .filter((index) => JSON.stringify(index) !== JSON.stringify(productionIndexes.get(index.name)))
    .map((index) => index.name);
  const migrationSql = await readFile(
    path.resolve("migrations/netlify/0001_runtime_schema_baseline.sql"),
    "utf8",
  );
  const destructiveStatements = migrationSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => /^(?:ALTER|DROP|DELETE|UPDATE|INSERT|REPLACE)\b/i.test(statement))
    .map((statement) => statement.match(/^\w+/)?.[0]?.toUpperCase());
  const allowedNewTables = new Set(["admin_audit_logs", "schema_migrations"]);
  const nonAdditiveMissingTables = missingTables.filter((name) => !allowedNewTables.has(name));
  const incompatibleChangedTables = changedTables.filter((name) => {
    const detail = changedTableDetails[name];
    return detail.missingColumns.length > 0
      || detail.changedColumns.length > 0
      || !detail.foreignKeysMatch
      || !detail.constraintsMatch;
  });
  const safeAdditive = nonAdditiveMissingTables.length === 0
    && incompatibleChangedTables.length === 0
    && changedIndexes.length === 0
    && destructiveStatements.length === 0;

  console.log(JSON.stringify({
    productionObjectCounts: {
      tables: production.tables.length,
      indexes: production.indexes.length,
    },
    expectedObjectCounts: {
      tables: expected.tables.length,
      indexes: expected.indexes.length,
    },
    missingTables,
    missingIndexes,
    extraTables,
    extraIndexes,
    changedTables,
    changedTableDetails,
    incompatibleChangedTables,
    changedIndexes,
    destructiveStatements,
    safeAdditive,
  }, null, 2));

  if (!safeAdditive) process.exitCode = 1;
} finally {
  await Promise.allSettled([expectedClient.close(), productionClient.close()]);
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
