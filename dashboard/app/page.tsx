import Link from "next/link";

const GITHUB = "https://github.com/Hijanhv/cardon";

const flow = [
  { step: "Simulate", body: "The agent's transaction is run through Helius simulation before anything is signed." },
  { step: "Check policy", body: "It's checked against an on-chain policy: per-tx cap, program allowlist, daily volume, kill switch." },
  { step: "Decide", body: "Under the threshold it auto-approves; over it, it's queued for a human; if a cap is hit, it's rejected." },
];

const accounts = [
  { name: "Agent", body: "Registers an agent's signing key, ties it to a policy, tracks an enabled flag and a pending-nonce counter." },
  { name: "Policy", body: "Per-agent rules: max lamports per tx, the HITL threshold, daily volume ceiling, allowed-program list." },
  { name: "PendingTx", body: "Created when a submission is over the threshold; closes and refunds rent on approve or reject." },
];

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <header className="flex justify-between items-center mb-20">
        <span className="text-lg font-semibold">Cardon Protocol</span>
        <nav className="flex gap-5 text-sm text-neutral-400">
          <Link href="/dashboard" className="hover:text-neutral-100">Dashboard</Link>
          <a href={GITHUB} className="hover:text-neutral-100">GitHub</a>
        </nav>
      </header>

      <section className="mb-24">
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">
          An on-chain transaction firewall for Solana AI agents.
        </h1>
        <p className="mt-6 text-lg text-neutral-400 leading-relaxed">
          Cardon sits between an autonomous agent and the network. Every transaction the
          agent wants to broadcast is simulated, checked against a policy stored in an Anchor
          program, and either signed, queued for a human approver, or rejected. Because the
          policy and approval rules live on-chain, no single operator can quietly raise a
          spend cap or remove a kill switch.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded text-sm font-medium hover:bg-white"
          >
            Open the approval queue
          </Link>
          <a
            href={GITHUB}
            className="px-4 py-2 border border-neutral-800 rounded text-sm hover:border-neutral-600"
          >
            Read the code
          </a>
        </div>
      </section>

      <section className="mb-24">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-6">The problem</h2>
        <p className="text-neutral-300 leading-relaxed">
          Agents can now sign and broadcast transactions on their own. One bad prompt, a
          jailbreak, or a model regression can drain a hot wallet, and there is no firewall
          between an agent&apos;s intent and the network. The closest existing product runs
          its policy as centralized middleware that anyone with code access can change.
          Cardon puts the policy in an Anchor program whose authority can be a multisig or a
          DAO, so rotating the rules is an on-chain transaction, not a config push.
        </p>
      </section>

      <section className="mb-24">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-6">How it works</h2>
        <ol className="space-y-5">
          {flow.map((f, i) => (
            <li key={f.step} className="flex gap-4">
              <span className="text-neutral-600 font-mono text-sm pt-0.5">{i + 1}</span>
              <div>
                <div className="font-medium">{f.step}</div>
                <p className="text-neutral-400 text-sm mt-1 leading-relaxed">{f.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-24">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-6">Program shape</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <div key={a.name} className="border border-neutral-800 rounded p-4">
              <div className="font-mono text-sm mb-2">{a.name}</div>
              <p className="text-neutral-400 text-sm leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
        <p className="text-neutral-500 text-sm mt-4">
          The audit trail is event-based: every approval, rejection, and policy change shows
          up in transaction logs and is indexed off-chain.
        </p>
      </section>

      <section className="mb-24">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-6">Integrate</h2>
        <p className="text-neutral-400 text-sm mb-4 leading-relaxed">
          Drop the firewall into an agent built on the Solana Agent Kit by wrapping its wallet.
        </p>
        <pre className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm overflow-x-auto">
          <code className="font-mono text-neutral-300">{`const wallet = new CardonWallet({ inner, client, agent, agentSigner });
const agentKit = new SolanaAgentKit(wallet, RPC_URL, {});
// a high-value tx now queues for human review instead of broadcasting`}</code>
        </pre>
      </section>

      <footer className="pt-8 border-t border-neutral-900 text-sm text-neutral-500 flex justify-between">
        <span>Turbin3 Builders capstone</span>
        <a href={GITHUB} className="hover:text-neutral-300">github.com/Hijanhv/cardon</a>
      </footer>
    </main>
  );
}
