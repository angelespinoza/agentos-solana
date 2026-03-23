/**
 * AgentOS — Payout Worker
 *
 * Corre cada N minutos y procesa los pagos pendientes al owner.
 * El flujo es:
 *   1. Usuario paga TOTAL → PLATFORM_WALLET (escrow)
 *   2. Este worker envía OWNER_USDC → owner_wallet
 *   3. PLATFORM_USDC queda en PLATFORM_WALLET (revenue de AgentOS)
 *
 * Para correr: tsx workers/payout-worker.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as bs58 from "bs58";

// ── Config ────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.SUPABASE_URL!;
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_KEY!;
const PLATFORM_KEYPAIR_BS58 = process.env.PLATFORM_KEYPAIR_BS58!;     // keypair de la platform wallet
const SOLANA_NETWORK      = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet-beta";
const USDC_MINT           = new PublicKey(process.env.USDC_MINT ?? "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJ"); // devnet USDC
const BATCH_SIZE          = 20;     // procesar hasta 20 payouts por ciclo
const INTERVAL_MS         = 60_000; // correr cada 60 segundos
const MIN_PAYOUT_USDC     = 0.001;  // no procesar montos menores a este valor

// ── Setup ─────────────────────────────────────────────────────────────────

const supabase    = createClient(SUPABASE_URL, SUPABASE_KEY);
const connection  = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");
const platformKP  = Keypair.fromSecretKey(bs58.decode(PLATFORM_KEYPAIR_BS58));

console.log(`🚀 Payout Worker iniciado`);
console.log(`   Platform wallet: ${platformKP.publicKey.toBase58()}`);
console.log(`   Network: ${SOLANA_NETWORK}`);
console.log(`   Batch size: ${BATCH_SIZE}`);
console.log(`   Intervalo: ${INTERVAL_MS / 1000}s\n`);

// ── Main loop ──────────────────────────────────────────────────────────────

async function processPendingPayouts(): Promise<void> {
  // 1. Obtener payouts pendientes
  const { data: payouts, error } = await supabase
    .from("platform_payouts")
    .select("*")
    .eq("status", "pending")
    .gte("owner_usdc", MIN_PAYOUT_USDC)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("Error al obtener payouts:", error.message);
    return;
  }

  if (!payouts || payouts.length === 0) return;

  console.log(`📦 Procesando ${payouts.length} payout(s)...`);

  // 2. Obtener la token account de la platform wallet (fuente)
  const platformTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    platformKP,
    USDC_MINT,
    platformKP.publicKey
  );

  let processed = 0;
  let failed    = 0;
  let totalSent = 0;

  for (const payout of payouts) {
    try {
      // Marcar como processing
      await supabase
        .from("platform_payouts")
        .update({ status: "processing" })
        .eq("id", payout.id);

      const ownerPubkey = new PublicKey(payout.owner_wallet);
      const amountMicro = Math.floor(payout.owner_usdc * 1_000_000);

      // Obtener/crear la token account del owner
      const ownerTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        platformKP,   // payer de la creación de la ATA si no existe
        USDC_MINT,
        ownerPubkey
      );

      // Construir la tx de transferencia USDC → owner
      const tx = new Transaction().add(
        createTransferInstruction(
          platformTokenAccount.address,  // from
          ownerTokenAccount.address,     // to
          platformKP.publicKey,          // authority
          amountMicro,
          [],
          undefined
        )
      );

      const txHash = await sendAndConfirmTransaction(connection, tx, [platformKP], {
        commitment: "confirmed",
      });

      // Marcar como completado
      await supabase
        .from("platform_payouts")
        .update({
          status:         "completed",
          payout_tx_hash: txHash,
          processed_at:   new Date().toISOString(),
        })
        .eq("id", payout.id);

      // Actualizar revenue diario de la plataforma
      await supabase.rpc("update_platform_revenue", {
        volume: payout.owner_usdc + payout.platform_usdc,
        fee:    payout.platform_usdc,
        payout: payout.owner_usdc,
      });

      totalSent += payout.owner_usdc;
      processed++;

      console.log(
        `  ✅ Payout ${payout.id}: $${payout.owner_usdc.toFixed(4)} USDC → ` +
        `${payout.owner_wallet.substring(0, 8)}... | TX: ${txHash.substring(0, 12)}...`
      );

    } catch (err: any) {
      failed++;
      console.error(`  ❌ Payout ${payout.id} fallido:`, err.message);

      await supabase
        .from("platform_payouts")
        .update({ status: "failed" })
        .eq("id", payout.id);
    }
  }

  console.log(
    `\n📊 Ciclo completado: ${processed} ok · ${failed} fallidos · $${totalSent.toFixed(4)} USDC enviado\n`
  );
}

// ── Revenue report ─────────────────────────────────────────────────────────

async function logRevenueStats(): Promise<void> {
  const { data } = await supabase
    .from("platform_revenue")
    .select("*")
    .order("date", { ascending: false })
    .limit(7);

  if (!data?.length) return;

  const total = data.reduce((s, r) => s + Number(r.platform_fees), 0);
  console.log(`\n💰 Revenue últimos ${data.length} días: $${total.toFixed(4)} USDC para AgentOS\n`);
}

// ── Start ──────────────────────────────────────────────────────────────────

async function main() {
  await logRevenueStats();

  // Primera ejecución inmediata
  await processPendingPayouts();

  // Loop cada INTERVAL_MS
  setInterval(processPendingPayouts, INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
