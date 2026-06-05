# cordon-audit-mirror

Two off-chain services that sit beside the Cordon program:

- **Indexer** — polls the program's transactions, decodes its `emit!` events with the Anchor `EventParser`, and writes them to an append-only store. The on-chain log stays canonical; this mirror exists for fast off-chain queries.
- **Webhook** — receives Helius transaction webhooks and records the broadcast leg of an approved tx as confirmed, closing the loop from approval to settlement.

Both share an `AuditStore`. The default is a JSONL store; implement the interface to back it with Postgres/Supabase.

## Run

```bash
npm install
CORDON_RPC=https://api.devnet.solana.com \
AUDIT_DIR=./audit-data \
WEBHOOK_PORT=8788 \
npm start
```

Env vars: `CORDON_RPC`, `AUDIT_DIR`, `WEBHOOK_PORT`, `POLL_MS`, `HELIUS_AUTH` (optional Authorization token the webhook requires).

Point a Helius webhook at `http://<host>:<port>/helius` (account address: the Cordon program ID) to feed broadcast confirmations.

## Use as a library

```ts
import { CordonIndexer, createWebhookServer, JsonlAuditStore } from "cordon-audit-mirror";

const store = new JsonlAuditStore("./audit-data");
const indexer = new CordonIndexer(connection, store);
await indexer.tick(); // index once, or indexer.run(5000) to loop
createWebhookServer(store, { authToken }).listen(8788);
```

Audit records: `{ signature, slot, blockTime, event, data }`, one JSON object per line in `audit.jsonl`. Broadcast confirmations land in `broadcasts.jsonl`.
