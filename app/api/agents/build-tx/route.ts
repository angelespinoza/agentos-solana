import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// ── Deriva el PDA del agente (debe coincidir con el Anchor program) ────────
function deriveAgentPDA(owner: PublicKey, agentId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("agent"),
      owner.toBuffer(),
      agentId.toArrayLike(Buffer, "le", 8),
    ],
    new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!)
  );
}

export async function POST(req: NextRequest) {
  let body: {
    agentId: string;
    owner: string;
    name: string;
    template: number;
    priceUsdc: number;
    accessType: number;
    nftCollection: string | null;
    configHash: number[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const owner   = new PublicKey(body.owner);
    const agentId = new BN(body.agentId);

    const [agentPDA] = deriveAgentPDA(owner, agentId);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    // En el hackathon, si el programa ya está deployado en devnet, 
    // aquí construiríamos la instrucción real de Anchor.
    // Para el demo usamos una tx de marcador que verifica que el owner firma.
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: owner,
    });

    // Memo instruction como placeholder on-chain del agente
    // En producción: program.methods.createAgent(...).instruction()
    const memoData = Buffer.from(JSON.stringify({
      agentOS: true,
      agentId: body.agentId,
      name: body.name,
      template: body.template,
      pda: agentPDA.toBase58(),
    }));

    tx.add({
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: memoData,
    });

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: serialized.toString("base64"),
      agentPDA: agentPDA.toBase58(),
    });

  } catch (err: any) {
    console.error("Build agent tx error:", err);
    return NextResponse.json(
      { error: "Error al construir la transacción" },
      { status: 500 }
    );
  }
}
