import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { CORDON_IDL, CORDON_PROGRAM_ID } from "@cordon/sdk";

import type { AuditStore } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Decode anchor event payloads (PublicKey, BN, byte arrays) into JSON-safe values.
function normalize(value: unknown): unknown {
  if (value instanceof PublicKey) return value.toBase58();
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const obj = value as { toBase58?: () => string; toString?: () => string };
    if (typeof obj.toBase58 === "function") return obj.toBase58();
    // BN and similar wrap an integer; stringify to avoid precision loss.
    if (obj.constructor?.name === "BN" && typeof obj.toString === "function") {
      return obj.toString();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        normalize(v),
      ])
    );
  }
  return value;
}

export class CordonIndexer {
  private readonly parser: EventParser;

  constructor(
    private readonly connection: Connection,
    private readonly store: AuditStore,
    private readonly programId: PublicKey = CORDON_PROGRAM_ID
  ) {
    this.parser = new EventParser(
      programId,
      new BorshCoder(CORDON_IDL as Idl)
    );
  }

  // Index new program transactions since the stored cursor. Returns event count.
  async tick(): Promise<number> {
    const until = (await this.store.cursor()) ?? undefined;
    const sigs = await this.connection.getSignaturesForAddress(
      this.programId,
      { until, limit: 100 },
      "confirmed"
    );
    if (sigs.length === 0) return 0;

    let events = 0;
    // Oldest first, so a crash mid-batch never skips records on resume.
    for (const info of [...sigs].reverse()) {
      if (info.err) continue;
      const tx = await this.connection.getTransaction(info.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      const logs = tx?.meta?.logMessages ?? [];
      for (const ev of this.parser.parseLogs(logs)) {
        await this.store.append({
          signature: info.signature,
          slot: info.slot,
          blockTime: info.blockTime ?? null,
          event: ev.name,
          data: normalize(ev.data) as Record<string, unknown>,
        });
        events++;
      }
    }

    await this.store.setCursor(sigs[0].signature);
    return events;
  }

  async run(intervalMs = 5000): Promise<void> {
    for (;;) {
      try {
        const n = await this.tick();
        if (n > 0) console.log(`indexed ${n} event(s)`);
      } catch (err) {
        console.error("indexer tick failed:", err);
      }
      await sleep(intervalMs);
    }
  }
}
