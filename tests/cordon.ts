import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { createHash } from "crypto";

import { Cordon } from "../target/types/cordon";

const SOL = (n: number) => new BN(n * LAMPORTS_PER_SOL);
const hashTx = (label: string): number[] =>
  Array.from(createHash("sha256").update(label).digest());

const findAgentPda = (programId: PublicKey, agentSigner: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentSigner.toBuffer()],
    programId
  );

const findPolicyPda = (programId: PublicKey, agent: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.toBuffer()],
    programId
  );

const findPendingPda = (programId: PublicKey, agent: PublicKey, nonce: BN) => {
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(BigInt(nonce.toString()));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pending"), agent.toBuffer(), nonceBytes],
    programId
  );
};

describe("cordon", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cordon as Program<Cordon>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const authority = Keypair.generate();
  const agentSigner = Keypair.generate();
  const jupiterProgram = Keypair.generate().publicKey;
  const orcaProgram = Keypair.generate().publicKey;

  const [agentPda] = findAgentPda(program.programId, agentSigner.publicKey);
  const [policyPda] = findPolicyPda(program.programId, agentPda);

  before(async () => {
    const sig = await provider.connection.requestAirdrop(
      authority.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("registers an agent and seeds an initial policy", async () => {
    await program.methods
      .registerAgent(SOL(1), SOL(0.1), SOL(10), [jupiterProgram, orcaProgram])
      .accountsStrict({
        payer: payer.publicKey,
        authority: authority.publicKey,
        agentSigner: agentSigner.publicKey,
        agent: agentPda,
        policy: policyPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.agentSigner.toBase58()).to.equal(agentSigner.publicKey.toBase58());
    expect(agent.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(agent.enabled).to.equal(true);

    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.maxLamportsPerTx.toString()).to.equal(SOL(1).toString());
    expect(policy.hitlThresholdLamports.toString()).to.equal(SOL(0.1).toString());
    expect(policy.allowedPrograms).to.have.lengthOf(2);
  });

  it("auto-approves a small tx to an allowed program", async () => {
    const lamports = SOL(0.05);
    const txHash = hashTx("swap-jup-1");

    await program.methods
      .submitAuto(txHash, lamports, jupiterProgram)
      .accountsStrict({
        agentSigner: agentSigner.publicKey,
        agent: agentPda,
        policy: policyPda,
      })
      .signers([agentSigner])
      .rpc();

    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.volumeToday.toString()).to.equal(lamports.toString());
  });

  it("rejects an auto submission over the HITL threshold", async () => {
    const lamports = SOL(0.5);
    const txHash = hashTx("swap-jup-2");

    try {
      await program.methods
        .submitAuto(txHash, lamports, jupiterProgram)
        .accountsStrict({
          agentSigner: agentSigner.publicKey,
          agent: agentPda,
          policy: policyPda,
        })
        .signers([agentSigner])
        .rpc();
      expect.fail("submitAuto should have failed for over-threshold lamports");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("OverPerTxCap");
    }
  });

  it("rejects an auto submission to a non-allowlisted program", async () => {
    const randomProgram = Keypair.generate().publicKey;
    try {
      await program.methods
        .submitAuto(hashTx("swap-rand"), SOL(0.01), randomProgram)
        .accountsStrict({
          agentSigner: agentSigner.publicKey,
          agent: agentPda,
          policy: policyPda,
        })
        .signers([agentSigner])
        .rpc();
      expect.fail("submitAuto should have failed for disallowed program");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("ProgramNotAllowed");
    }
  });

  it("queues a high-value tx for human review and approves it", async () => {
    const agentBefore = await program.account.agent.fetch(agentPda);
    const nonce = agentBefore.nextPendingNonce;
    const [pendingPda] = findPendingPda(program.programId, agentPda, nonce);
    const lamports = SOL(0.5);
    const txHash = hashTx("buy-spl-1");

    await program.methods
      .submitForReview(txHash, lamports, orcaProgram)
      .accountsStrict({
        payer: payer.publicKey,
        agentSigner: agentSigner.publicKey,
        agent: agentPda,
        policy: policyPda,
        pending: pendingPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentSigner])
      .rpc();

    const pendingBefore = await program.account.pendingTx.fetch(pendingPda);
    expect(pendingBefore.lamports.toString()).to.equal(lamports.toString());
    expect(pendingBefore.status).to.deep.equal({ pending: {} });

    const policyBefore = await program.account.policy.fetch(policyPda);
    const volumeBefore = policyBefore.volumeToday;

    await program.methods
      .approveTx()
      .accountsStrict({
        authority: authority.publicKey,
        rentReceiver: payer.publicKey,
        agent: agentPda,
        policy: policyPda,
        pending: pendingPda,
      })
      .signers([authority])
      .rpc();

    const policyAfter = await program.account.policy.fetch(policyPda);
    expect(policyAfter.volumeToday.toString()).to.equal(
      volumeBefore.add(lamports).toString()
    );

    const closed = await provider.connection.getAccountInfo(pendingPda);
    expect(closed).to.equal(null);
  });

  it("rejects a pending tx", async () => {
    const agentBefore = await program.account.agent.fetch(agentPda);
    const nonce = agentBefore.nextPendingNonce;
    const [pendingPda] = findPendingPda(program.programId, agentPda, nonce);

    await program.methods
      .submitForReview(hashTx("buy-spl-2"), SOL(0.3), orcaProgram)
      .accountsStrict({
        payer: payer.publicKey,
        agentSigner: agentSigner.publicKey,
        agent: agentPda,
        policy: policyPda,
        pending: pendingPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentSigner])
      .rpc();

    await program.methods
      .rejectTx(1)
      .accountsStrict({
        authority: authority.publicKey,
        rentReceiver: payer.publicKey,
        agent: agentPda,
        pending: pendingPda,
      })
      .signers([authority])
      .rpc();

    const closed = await provider.connection.getAccountInfo(pendingPda);
    expect(closed).to.equal(null);
  });

  it("blocks submissions when the agent is disabled", async () => {
    await program.methods
      .setEnabled(false)
      .accountsStrict({
        authority: authority.publicKey,
        agent: agentPda,
      })
      .signers([authority])
      .rpc();

    try {
      await program.methods
        .submitAuto(hashTx("swap-jup-3"), SOL(0.01), jupiterProgram)
        .accountsStrict({
          agentSigner: agentSigner.publicKey,
          agent: agentPda,
          policy: policyPda,
        })
        .signers([agentSigner])
        .rpc();
      expect.fail("submitAuto should have failed while agent is disabled");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("AgentDisabled");
    }

    await program.methods
      .setEnabled(true)
      .accountsStrict({
        authority: authority.publicKey,
        agent: agentPda,
      })
      .signers([authority])
      .rpc();
  });

  it("rejects registration when hitl_threshold > max_lamports_per_tx", async () => {
    const stranger = Keypair.generate();
    const [strangerAgent] = findAgentPda(program.programId, stranger.publicKey);
    const [strangerPolicy] = findPolicyPda(program.programId, strangerAgent);

    try {
      await program.methods
        .registerAgent(SOL(0.1), SOL(1), SOL(10), [jupiterProgram])
        .accountsStrict({
          payer: payer.publicKey,
          authority: authority.publicKey,
          agentSigner: stranger.publicKey,
          agent: strangerAgent,
          policy: strangerPolicy,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("registerAgent should have failed on threshold > cap");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("InvalidThresholdOrdering");
    }
  });

  it("rejects a submission that would breach the daily volume ceiling", async () => {
    const lowVolumeSigner = Keypair.generate();
    const [lowAgent] = findAgentPda(program.programId, lowVolumeSigner.publicKey);
    const [lowPolicy] = findPolicyPda(program.programId, lowAgent);

    await program.methods
      .registerAgent(SOL(0.5), SOL(0.5), SOL(0.4), [jupiterProgram])
      .accountsStrict({
        payer: payer.publicKey,
        authority: authority.publicKey,
        agentSigner: lowVolumeSigner.publicKey,
        agent: lowAgent,
        policy: lowPolicy,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .submitAuto(hashTx("vol-1"), SOL(0.3), jupiterProgram)
      .accountsStrict({
        agentSigner: lowVolumeSigner.publicKey,
        agent: lowAgent,
        policy: lowPolicy,
      })
      .signers([lowVolumeSigner])
      .rpc();

    try {
      await program.methods
        .submitAuto(hashTx("vol-2"), SOL(0.2), jupiterProgram)
        .accountsStrict({
          agentSigner: lowVolumeSigner.publicKey,
          agent: lowAgent,
          policy: lowPolicy,
        })
        .signers([lowVolumeSigner])
        .rpc();
      expect.fail("submitAuto should have failed on volume ceiling");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("OverDailyVolume");
    }
  });
});
