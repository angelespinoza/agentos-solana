import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { createHash } from "crypto";

describe("agent-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AgentRegistry as Program;
  const owner = provider.wallet.publicKey;

  let agentPDA: PublicKey;
  let agentBump: number;
  const agentId = new BN(Date.now());

  const hashPrompt = (prompt: string): number[] =>
    Array.from(createHash("sha256").update(prompt).digest());

  const deriveAgentPDA = (owner: PublicKey, agentId: BN) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        owner.toBuffer(),
        agentId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

  before(() => {
    [agentPDA, agentBump] = deriveAgentPDA(owner, agentId);
  });

  // ─── CREATE ──────────────────────────────────────────────────────────────

  it("✅ Crea un agente exitosamente", async () => {
    const systemPrompt = "Soy un asistente de IA especializado en Solana.";

    const tx = await program.methods
      .createAgent({
        agentId,
        name: "SolanaGPT",
        template: 0,
        pricePerUse: new BN(10_000), // 0.01 USDC
        accessType: 0,               // Public
        nftCollection: null,
        configHash: hashPrompt(systemPrompt),
      })
      .accounts({
        agent: agentPDA,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  TX:", tx);

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.equal(agent.name, "SolanaGPT");
    assert.equal(agent.template, 0);
    assert.ok(agent.owner.equals(owner));
    assert.deepEqual(agent.status, { active: {} });
    assert.equal(agent.usesTotal.toNumber(), 0);
    assert.equal(agent.revenueTotal.toNumber(), 0);
  });

  // ─── UPDATE PRICE ─────────────────────────────────────────────────────────

  it("✅ Owner puede actualizar el precio", async () => {
    await program.methods
      .updatePrice(new BN(50_000)) // 0.05 USDC
      .accounts({ agent: agentPDA, owner })
      .rpc();

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.equal(agent.priceLamports.toNumber(), 50_000);
  });

  // ─── UPDATE CONFIG ────────────────────────────────────────────────────────

  it("✅ Owner puede actualizar el config hash", async () => {
    const newPrompt = "Soy un experto en DeFi y protocolos de Solana.";
    const newHash = hashPrompt(newPrompt);

    await program.methods
      .updateConfig(newHash)
      .accounts({ agent: agentPDA, owner })
      .rpc();

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.deepEqual(Array.from(agent.configHash), newHash);
  });

  // ─── RECORD PAYMENT ───────────────────────────────────────────────────────

  it("✅ Registra un pago correctamente", async () => {
    await program.methods
      .recordPayment(new BN(10_000))
      .accounts({ agent: agentPDA, authority: owner })
      .rpc();

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.equal(agent.usesTotal.toNumber(), 1);
    assert.equal(agent.revenueTotal.toNumber(), 10_000);
  });

  // ─── PAUSE ────────────────────────────────────────────────────────────────

  it("✅ Owner puede pausar el agente", async () => {
    await program.methods
      .setStatus(1) // Paused
      .accounts({ agent: agentPDA, owner })
      .rpc();

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.deepEqual(agent.status, { paused: {} });
  });

  it("✅ Owner puede reactivar el agente", async () => {
    await program.methods
      .setStatus(0) // Active
      .accounts({ agent: agentPDA, owner })
      .rpc();

    const agent = await program.account.agentAccount.fetch(agentPDA);
    assert.deepEqual(agent.status, { active: {} });
  });

  // ─── UNAUTHORIZED ─────────────────────────────────────────────────────────

  it("❌ Non-owner no puede pausar el agente", async () => {
    const hacker = Keypair.generate();

    try {
      await program.methods
        .setStatus(1)
        .accounts({ agent: agentPDA, owner: hacker.publicKey })
        .signers([hacker])
        .rpc();
      assert.fail("Debería haber fallado");
    } catch (err: any) {
      assert.include(err.message, "Unauthorized");
    }
  });

  it("❌ No acepta nombres vacíos", async () => {
    const badId = new BN(Date.now() + 1);
    const [badPDA] = deriveAgentPDA(owner, badId);

    try {
      await program.methods
        .createAgent({
          agentId: badId,
          name: "",
          template: 0,
          pricePerUse: new BN(10_000),
          accessType: 0,
          nftCollection: null,
          configHash: hashPrompt("test"),
        })
        .accounts({ agent: badPDA, owner, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch (err: any) {
      assert.include(err.message, "NameEmpty");
    }
  });

  // ─── CLOSE ────────────────────────────────────────────────────────────────

  it("✅ Owner puede cerrar el agente y recuperar lamports", async () => {
    const balanceBefore = await provider.connection.getBalance(owner);

    await program.methods
      .closeAgent()
      .accounts({ agent: agentPDA, owner })
      .rpc();

    const balanceAfter = await provider.connection.getBalance(owner);
    assert.isAbove(balanceAfter, balanceBefore, "Debería recuperar lamports");

    try {
      await program.account.agentAccount.fetch(agentPDA);
      assert.fail("La cuenta debería estar cerrada");
    } catch {
      // Expected
    }
  });
});
