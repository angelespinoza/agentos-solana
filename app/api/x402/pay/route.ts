import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// USDC en devnet (token de prueba)
const USDC_MINT_DEVNET = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJ");

/**
 * Construye una transacción de pago USDC para x402
 * El cliente la firma con su wallet y la retorna como X-PAYMENT header
 */
export async function POST(req: NextRequest) {
  let body: {
    requirements: {
      payTo: string;
      maxAmountRequired: string;
      asset: string;
      network: string;
    };
    walletAddress: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { requirements, walletAddress } = body;

  if (!requirements || !walletAddress) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const payer    = new PublicKey(walletAddress);
    const receiver = new PublicKey(requirements.payTo);
    const amount   = BigInt(requirements.maxAmountRequired);

    // En devnet usamos SOL para simplificar el demo
    // En producción sería USDC SPL token
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: payer,
    });

    if (amount > 0n) {
      // Transferencia SOL (devnet demo)
      // En producción: createTransferInstruction con USDC SPL
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey:   receiver,
          lamports:   Number(amount), // amount en lamports para devnet
        })
      );
    }

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures:     false,
    });

    return NextResponse.json({
      transaction:          serialized.toString("base64"),
      blockhash,
      lastValidBlockHeight,
    });

  } catch (err: any) {
    console.error("Build tx error:", err);
    return NextResponse.json(
      { error: "Error al construir la transacción" },
      { status: 500 }
    );
  }
}
