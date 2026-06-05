import { Connection } from "@solana/web3.js";

import { JsonlAuditStore } from "./store";
import { CardonIndexer } from "./indexer";
import { createWebhookServer } from "./webhook";

export * from "./store";
export { CardonIndexer } from "./indexer";
export { createWebhookServer, type WebhookOptions } from "./webhook";

async function main() {
  const rpc = process.env.CARDON_RPC ?? "http://127.0.0.1:8899";
  const dir = process.env.AUDIT_DIR ?? "./audit-data";
  const port = Number(process.env.WEBHOOK_PORT ?? 8788);
  const pollMs = Number(process.env.POLL_MS ?? 5000);
  const authToken = process.env.HELIUS_AUTH;

  const store = new JsonlAuditStore(dir);

  const server = createWebhookServer(store, { authToken });
  server.listen(port, () =>
    console.log(`webhook listening on :${port}/helius`)
  );

  const indexer = new CardonIndexer(new Connection(rpc, "confirmed"), store);
  console.log(`indexing ${rpc} -> ${dir}`);
  await indexer.run(pollMs);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
