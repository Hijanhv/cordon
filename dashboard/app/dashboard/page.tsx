"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

import { PendingTxRow } from "@/components/pending-tx-row";
import {
  CordonProgram,
  fetchPendingForAgent,
  getProvider,
  loadProgram,
  PendingTxAccount,
} from "@/lib/cordon-program";

export default function Page() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [agentInput, setAgentInput] = useState("");
  const [agent, setAgent] = useState<PublicKey | null>(null);
  const [program, setProgram] = useState<CordonProgram | null>(null);
  const [pending, setPending] = useState<PendingTxAccount[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setProgram(null);
      return;
    }
    try {
      const provider = getProvider(connection, wallet);
      setProgram(loadProgram(provider));
    } catch (e: any) {
      setErr(e?.message ?? "failed to load Cordon program");
    }
  }, [wallet, connection]);

  const refresh = useCallback(async () => {
    if (!program || !agent) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchPendingForAgent(program, agent);
      setPending(list);
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  }, [program, agent]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleLoad() {
    try {
      const pk = new PublicKey(agentInput.trim());
      setAgent(pk);
    } catch {
      setErr("invalid pubkey");
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <header className="flex justify-between items-center mb-8">
        <Link href="/" className="text-2xl font-semibold hover:text-neutral-300">
          Cardon Protocol
        </Link>
        <WalletMultiButton />
      </header>

      <section className="mb-8">
        <label className="block text-sm text-neutral-400 mb-2">Agent PDA</label>
        <div className="flex gap-2">
          <input
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            placeholder="Paste the agent account pubkey"
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={handleLoad}
            disabled={!agentInput}
            className="px-4 py-2 bg-neutral-200 text-neutral-900 rounded disabled:opacity-50"
          >
            Load
          </button>
        </div>
      </section>

      {err && (
        <div className="bg-red-950 border border-red-900 text-red-200 text-sm px-3 py-2 rounded mb-4">
          {err}
        </div>
      )}

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500">
            Pending approvals
          </h2>
          <button
            onClick={refresh}
            disabled={!program || !agent || loading}
            className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
          >
            {loading ? "loading…" : "refresh"}
          </button>
        </div>

        {!wallet && (
          <p className="text-neutral-500 text-sm">Connect a wallet to continue.</p>
        )}

        {wallet && !agent && (
          <p className="text-neutral-500 text-sm">Load an agent to see its queue.</p>
        )}

        {wallet && agent && pending.length === 0 && !loading && (
          <p className="text-neutral-500 text-sm">No pending transactions.</p>
        )}

        <div className="flex flex-col gap-3">
          {program &&
            agent &&
            pending.map((p) => (
              <PendingTxRow
                key={p.publicKey.toBase58()}
                pending={p}
                agent={agent}
                program={program}
                onChanged={refresh}
              />
            ))}
        </div>
      </section>
    </main>
  );
}
