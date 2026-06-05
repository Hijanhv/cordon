/**
 * Toy "Jupiter swap agent" that routes every transaction through the Cardon
 * firewall via {@link CardonWallet}. Demonstrates the one-wrap integration: the
 * agent code is unchanged, but a high-value swap now gets queued for human
 * review instead of broadcasting.
 *
 * Run against a local validator / devnet with the program deployed and an agent
 * registered:
 *
 * ```bash
 * CARDON_RPC=https://api.devnet.solana.com \
 * CARDON_PAYER=~/.config/solana/id.json \
 * AGENT_SIGNER=./agent-signer.json \
 * AGENT_PDA=<agent pda> \
 * TARGET_PROGRAM=<allowed program> \
 * npx ts-node src/index.ts
 * ```
 */
import { readFileSync } from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  SystemProgram,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { CardonClient } from "@cardon/sdk";
import {
  CardonWallet,
  CardonReviewRequiredError,
  CardonPolicyDeniedError,
  type BaseWallet,
} from "@cardon/agent-kit";

function loadKeypair(path: string): Keypair {
  const secret = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")));
  return Keypair.fromSecretKey(secret);
}

/** A minimal Keypair-backed wallet standing in for the agent's real wallet. */
class KeypairWallet implements BaseWallet {
  constructor(
    private readonly keypair: Keypair,
    private readonly connection: Connection
  ) {}

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([this.keypair]);
    else tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]> {
    return Promise.all(txs.map((t) => this.signTransaction(t)));
  }

  async signAndSendTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
    options?: SendOptions
  ): Promise<{ signature: TransactionSignature }> {
    const signed = await this.signTransaction(tx);
    const raw = signed.serialize();
    const signature = await this.connection.sendRawTransaction(raw, options);
    return { signature };
  }

  async signMessage(_message: Uint8Array): Promise<Uint8Array> {
    throw new Error("signMessage not supported in this demo wallet");
  }
}

async function main() {
  const rpc = process.env.CARDON_RPC ?? "http://127.0.0.1:8899";
  const connection = new Connection(rpc, "confirmed");

  const feePayer = loadKeypair(
    process.env.CARDON_PAYER ?? `${process.env.HOME}/.config/solana/id.json`
  );
  const agentSigner = loadKeypair(process.env.AGENT_SIGNER ?? "./agent-signer.json");
  const agent = new PublicKey(process.env.AGENT_PDA ?? PublicKey.default.toBase58());
  const targetProgram = new PublicKey(
    process.env.TARGET_PROGRAM ?? PublicKey.default.toBase58()
  );

  // Cardon's client uses its own funded fee payer to record decisions on-chain.
  const client = CardonClient.fromConnection(
    connection,
    new Wallet(feePayer)
  );

  // The agent's real wallet, now wrapped by the firewall.
  const inner = new KeypairWallet(agentSigner, connection);
  const wallet = new CardonWallet({
    inner,
    client,
    agent,
    agentSigner,
    // The swap moves SOL via SystemProgram here; in a real Jupiter swap supply
    // the value + program explicitly through resolveIntent.
    resolveIntent: () => ({
      lamports: new BN(500_000_000), // 0.5 SOL — above a typical HITL threshold
      targetProgram,
    }),
  });

  // The "swap" the agent wants to broadcast.
  const swap = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: inner.publicKey,
      toPubkey: targetProgram,
      lamports: 500_000_000,
    })
  );
  swap.feePayer = inner.publicKey;
  swap.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  try {
    const signed = await wallet.signTransaction(swap);
    console.log("auto-approved and signed:", signed.signature?.toString());
  } catch (err) {
    if (err instanceof CardonReviewRequiredError) {
      console.log(
        `queued for human review — approve it in the dashboard. pending=${err.pending.toBase58()}`
      );
    } else if (err instanceof CardonPolicyDeniedError) {
      console.log(`firewall rejected the swap: ${err.denial}`);
    } else {
      throw err;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
