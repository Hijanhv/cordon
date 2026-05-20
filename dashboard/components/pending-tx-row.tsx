"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

import type { CordonProgram, PendingTxAccount } from "@/lib/cordon-program";

function formatSol(lamports: bigint): string {
  const sol = Number(lamports) / 1_000_000_000;
  return sol.toFixed(4);
}

function shortPubkey(pk: PublicKey): string {
  const s = pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function hashPreview(hash: number[]): string {
  const hex = Buffer.from(hash).toString("hex");
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

interface Props {
  pending: PendingTxAccount;
  agent: PublicKey;
  program: CordonProgram;
  onChanged: () => void;
}

export function PendingTxRow({ pending, agent, program, onChanged }: Props) {
  const wallet = useAnchorWallet();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const proposedAgo = (() => {
    const now = Math.floor(Date.now() / 1000);
    const delta = now - pending.proposedAt.toNumber();
    if (delta < 60) return `${delta}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    return `${Math.floor(delta / 3600)}h ago`;
  })();

  async function handleApprove() {
    if (!wallet) return;
    setBusy("approve");
    setErr(null);
    try {
      await program.methods
        .approveTx()
        .accountsStrict({
          authority: wallet.publicKey,
          rentReceiver: wallet.publicKey,
          agent,
          policy: PublicKey.findProgramAddressSync(
            [Buffer.from("policy"), agent.toBuffer()],
            program.programId
          )[0],
          pending: pending.publicKey,
        })
        .rpc();
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "approve failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!wallet) return;
    setBusy("reject");
    setErr(null);
    try {
      await program.methods
        .rejectTx(1)
        .accountsStrict({
          authority: wallet.publicKey,
          rentReceiver: wallet.publicKey,
          agent,
          pending: pending.publicKey,
        })
        .rpc();
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "reject failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <div className="font-mono text-sm text-neutral-400">
          {hashPreview(pending.txHash)}
        </div>
        <div className="text-xs text-neutral-500">{proposedAgo}</div>
      </div>

      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-neutral-500 text-xs">Amount</div>
          <div>{formatSol(BigInt(pending.lamports.toString()))} SOL</div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs">Target</div>
          <div className="font-mono">{shortPubkey(pending.targetProgram)}</div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs">Nonce</div>
          <div>{pending.nonce.toString()}</div>
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={handleApprove}
          disabled={busy !== null || !wallet}
          className="px-3 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded"
        >
          {busy === "approve" ? "approving…" : "Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={busy !== null || !wallet}
          className="px-3 py-1.5 text-sm bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded"
        >
          {busy === "reject" ? "rejecting…" : "Reject"}
        </button>
      </div>

      {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
    </div>
  );
}
