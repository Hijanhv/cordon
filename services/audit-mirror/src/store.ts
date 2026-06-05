import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface AuditRecord {
  signature: string;
  slot: number;
  blockTime: number | null;
  event: string;
  data: Record<string, unknown>;
}

export interface BroadcastConfirmation {
  signature: string;
  slot: number;
  receivedAt: string;
}

// The on-chain event log is canonical; this is a queryable off-chain mirror.
export interface AuditStore {
  append(record: AuditRecord): Promise<void>;
  confirmBroadcast(confirmation: BroadcastConfirmation): Promise<void>;
  cursor(): Promise<string | null>;
  setCursor(signature: string): Promise<void>;
}

// Append-only JSONL store. Swap in Postgres/Supabase by implementing AuditStore.
export class JsonlAuditStore implements AuditStore {
  private readonly auditPath: string;
  private readonly broadcastPath: string;
  private readonly cursorPath: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.auditPath = join(dir, "audit.jsonl");
    this.broadcastPath = join(dir, "broadcasts.jsonl");
    this.cursorPath = join(dir, "cursor.txt");
  }

  async append(record: AuditRecord): Promise<void> {
    appendFileSync(this.auditPath, JSON.stringify(record) + "\n");
  }

  async confirmBroadcast(confirmation: BroadcastConfirmation): Promise<void> {
    appendFileSync(this.broadcastPath, JSON.stringify(confirmation) + "\n");
  }

  async cursor(): Promise<string | null> {
    return existsSync(this.cursorPath)
      ? readFileSync(this.cursorPath, "utf8").trim() || null
      : null;
  }

  async setCursor(signature: string): Promise<void> {
    mkdirSync(dirname(this.cursorPath), { recursive: true });
    writeFileSync(this.cursorPath, signature);
  }
}
