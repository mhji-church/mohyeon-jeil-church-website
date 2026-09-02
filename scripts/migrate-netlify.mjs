import { createClient } from "@libsql/client";
import { applyNetlifyMigrations } from "./netlify-migrations.mjs";

const isProductionDeploy =
  process.env.NETLIFY === "true" &&
  process.env.CONTEXT === "production" &&
  process.env.BRANCH === "agent/netlify-deployment";

if (!isProductionDeploy) {
  console.log("Skipping Turso migrations outside the Netlify production branch.");
  process.exit(0);
}

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) {
  throw new Error("Production migration credentials are not configured.");
}

const client = createClient({ url, authToken });
try {
  const files = await applyNetlifyMigrations(client);
  console.log(`Verified ${files.length} production schema migration(s).`);
} finally {
  await client.close();
}
