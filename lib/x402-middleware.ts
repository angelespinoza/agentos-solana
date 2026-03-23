import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey } from "@solana/web3.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

import { networkConfig } from "../lib/network";

const connection = new Connection(networkConfig.clusterApiUrl, "confirmed");

// ── Platform fee config ───────────────────────────────────────────────────
//    El pago llega completo al PLATFORM_WALLET (escrow),
//    luego se reenvía el (100 - FEE)% al owner del agente.

const PLATFORM_FEE_BPS  = Number(process.env.PLATFORM_FEE_BPS ?? 500); // 500 = 5%
const PLATFORM_WALLET   = process.env.PLATFORM_WALLET!;                 // tu wallet de AgentOS
const MIN_FEE_USDC      = 0.001;                                        // mínimo que cobra la plataforma

/** Calcula el split de un pago */
function calculateSplit(totalUsdc: number): {
  platformUsdc: number;
  ownerUsdc:    number;
  feePercent:   number;
} {
  const feePercent   = PLATFORM_FEE_BPS / 100;                              // ej: 5
  const platformUsdc = Math.max(totalUsdc * (PLATFORM_FEE_BPS / 10_000), MIN_FEE_USDC);
  const ownerUsdc    = Math.max(totalUsdc - platformUsdc, 0);
  return { platformUsdc, ownerUsdc, feePercent };
}

/**
 * Reenvía la parte del owner después de que el pago llegó al escrow de la plataforma.
 * En producción esto sería una tx firmada por el keypair del PLATFORM_WALLET.
 * Para el hackathon lo registramos en Supabase y lo procesamos en batch.
 */
async function scheduleOwnerPayout(params: {
  agentId:      string;
  ownerWallet:  string;
  ownerUsdc:    number;
  platformUsdc: number;
  sourceTxHash: string;
}): Promise<void> {
  await supabase.from("platform_payouts").insert({
    agent_id:       params.agentId,
    owner_wallet:   params.ownerWallet,
    owner_usdc:     params.ownerUsdc,
    platform_usdc:  params.platformUsdc,
    source_tx_hash: params.sourceTxHash,
    status:         "pending",
    created_at:     new Date().toISOString(),
  });
}

// ── x402 payment verification ─────────────────────────────────────────────

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
}

interface X402Payment {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    transaction: string;
  };
}

/**
 * Verifica un pago x402 via el facilitador de Coinbase
 */
async function verifyX402Payment(
  payment: X402Payment,
  requirements: PaymentRequirements
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const facilitatorUrl =
      process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

    const res = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment, paymentRequirements: requirements }),
    });

    if (!res.ok) return { valid: false, reason: "Facilitador no disponible" };

    const { isValid, invalidReason } = await res.json();
    return { valid: isValid, reason: invalidReason };
  } catch (err) {
    return { valid: false, reason: "Error al verificar pago" };
  }
}

/**
 * Liquida un pago x402 confirmado
 */
async function settleX402Payment(
  payment: X402Payment,
  requirements: PaymentRequirements
): Promise<{ success: boolean; txHash?: string }> {
  try {
    const facilitatorUrl =
      process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

    const res = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment, paymentRequirements: requirements }),
    });

    if (!res.ok) return { success: false };

    const { txHash } = await res.json();
    return { success: true, txHash };
  } catch {
    return { success: false };
  }
}

/**
 * Verifica acceso NFT-Gated usando Metaplex
 */
async function verifyNFTAccess(
  walletAddress: string,
  collectionAddress: string
): Promise<boolean> {
  try {
    // Consultar los token accounts del wallet
    const wallet = new PublicKey(walletAddress);
    const collection = new PublicKey(collectionAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet,
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
    );

    // Verificar si alguno es de la colección especificada
    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed?.info?.mint;
      if (!mint) continue;

      // Verificar metadata del NFT
      const res = await fetch(
        `${process.env.HELIUS_RPC_URL}/v0/tokens/metadata`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mintAccounts: [mint] }),
        }
      );

      if (!res.ok) continue;
      const [metadata] = await res.json();

      if (metadata?.collection?.id === collectionAddress) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("NFT verification error:", err);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function agentQueryHandler(
  req: NextRequest,
  agentId: string
): Promise<NextResponse> {

  // 1. Cargar el agente de Supabase
  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "active")
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
  }

  const { platformUsdc, ownerUsdc, feePercent } = calculateSplit(agent.price_usdc);
  const totalMicro = Math.floor(agent.price_usdc * 1_000_000);

  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: networkConfig.x402Network,          // ← "solana:mainnet" o "solana:devnet"
    maxAmountRequired: String(totalMicro),
    resource: `${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/${agentId}/query`,
    description: `Consulta al agente ${agent.name} · ${feePercent}% plataforma AgentOS`,
    mimeType: "application/json",
    payTo: PLATFORM_WALLET,
    maxTimeoutSeconds: 300,
    asset: networkConfig.usdcMint,               // ← USDC correcto según la red
  };

  // 3. Verificar si hay pago en el header X-PAYMENT
  const paymentHeader = req.headers.get("X-PAYMENT");

  if (false && agent.price_usdc > 0 && !paymentHeader) {
    // → 402 Payment Required
    return NextResponse.json(
      {
        x402Version: 1,
        accepts: [paymentRequirements],
        error: "Payment required",
      },
      {
        status: 402,
        headers: {
          "X-PAYMENT-RESPONSE": JSON.stringify(paymentRequirements),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // 4. Si hay pago, verificarlo
  if (false && paymentHeader && agent.price_usdc > 0) {
    let payment: X402Payment;
    try {
      payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
    } catch {
      return NextResponse.json({ error: "Header X-PAYMENT inválido" }, { status: 400 });
    }

    const { valid, reason } = await verifyX402Payment(payment, paymentRequirements);
    if (!valid) {
      return NextResponse.json({ error: `Pago inválido: ${reason}` }, { status: 402 });
    }

    // Liquidar el pago
    const { success, txHash } = await settleX402Payment(payment, paymentRequirements);
    if (!success) {
      return NextResponse.json({ error: "Error al liquidar el pago" }, { status: 402 });
    }

    // Registrar el pago con el split en Supabase
    await supabase.from("agent_payments").insert({
      agent_id:       agentId,
      tx_hash:        txHash,
      amount_usdc:    agent.price_usdc,
      platform_usdc:  platformUsdc,
      owner_usdc:     ownerUsdc,
      fee_bps:        PLATFORM_FEE_BPS,
      created_at:     new Date().toISOString(),
    });

    // Programar el payout al owner (procesado en batch por el worker)
    await scheduleOwnerPayout({
      agentId,
      ownerWallet:  agent.owner,
      ownerUsdc,
      platformUsdc,
      sourceTxHash: txHash!,
    });

    // Actualizar revenue del agente (solo la parte del owner)
    await supabase.rpc("add_agent_revenue", {
      agent_id_param: agentId,
      amount:         ownerUsdc,
    });
  }

  // 5. Verificar acceso NFT-Gated
  if (agent.access_type === 1 && agent.nft_collection) {
    const callerWallet = req.headers.get("X-WALLET-ADDRESS");
    if (!callerWallet) {
      return NextResponse.json(
        { error: "Se requiere X-WALLET-ADDRESS para agentes NFT-Gated" },
        { status: 403 }
      );
    }

    const hasAccess = await verifyNFTAccess(callerWallet, agent.nft_collection);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Acceso denegado",
          reason: `Necesitas un NFT de la colección ${agent.nft_collection}`,
        },
        { status: 403 }
      );
    }
  }

  // 6. Ejecutar el agente ✅
  return null as any; // continúa al handler del agente
}
