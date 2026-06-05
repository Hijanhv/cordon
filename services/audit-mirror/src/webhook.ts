import { createServer, type Server } from "http";

import type { AuditStore } from "./store";

interface HeliusTx {
  signature?: string;
  slot?: number;
}

export interface WebhookOptions {
  // If set, requests must carry a matching Authorization header (Helius supports this).
  authToken?: string;
  path?: string;
}

// Receives Helius transaction webhooks and records the broadcast leg of an
// approved tx as confirmed, closing the loop from approval to settlement.
export function createWebhookServer(
  store: AuditStore,
  options: WebhookOptions = {}
): Server {
  const path = options.path ?? "/helius";

  return createServer((req, res) => {
    if (req.method !== "POST" || (req.url ?? "") !== path) {
      res.writeHead(404).end();
      return;
    }
    if (options.authToken && req.headers.authorization !== options.authToken) {
      res.writeHead(401).end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "[]");
        const txs: HeliusTx[] = Array.isArray(payload) ? payload : [payload];
        const receivedAt = new Date().toISOString();

        let confirmed = 0;
        for (const tx of txs) {
          if (!tx.signature) continue;
          await store.confirmBroadcast({
            signature: tx.signature,
            slot: tx.slot ?? 0,
            receivedAt,
          });
          confirmed++;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ confirmed }));
      } catch (err) {
        console.error("webhook parse failed:", err);
        res.writeHead(400).end();
      }
    });
  });
}
