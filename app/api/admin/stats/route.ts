import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── GET /api/admin/stats — stats globales de la plataforma ────────────────
// Protegido por ADMIN_SECRET en el header

export async function GET(req: NextRequest) {
  const secret = req.headers.get("X-Admin-Secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [
    { data: agents },
    { data: payments },
    { data: payouts },
    { data: revenue },
  ] = await Promise.all([
    supabase.from("agents").select("agent_id, name, price_usdc, uses_total, revenue_total, template"),
    supabase.from("agent_payments").select("amount_usdc, platform_usdc, owner_usdc, created_at"),
    supabase.from("platform_payouts").select("status, owner_usdc"),
    supabase.from("platform_revenue").select("*").order("date", { ascending: false }).limit(30),
    ]);

  const totalVolume   = (payments ?? []).reduce((s, p) => s + Number(p.amount_usdc), 0);
  const totalPlatform = (payments ?? []).reduce((s, p) => s + Number(p.platform_usdc), 0);
  const totalOwners   = (payments ?? []).reduce((s, p) => s + Number(p.owner_usdc), 0);

  const pendingPayouts    = (payouts ?? []).filter(p => p.status === "pending").length;
  const pendingPayoutUSDC = (payouts ?? [])
    .filter(p => p.status === "pending")
    .reduce((s, p) => s + Number(p.owner_usdc), 0);

  return NextResponse.json({
    platform: {
      totalAgents:       (agents ?? []).length,
      totalVolume:       totalVolume.toFixed(4),
      platformRevenue:   totalPlatform.toFixed(4),
      ownerPayouts:      totalOwners.toFixed(4),
      pendingPayouts,
      pendingPayoutUSDC: pendingPayoutUSDC.toFixed(4),
      feeBps:            Number(process.env.PLATFORM_FEE_BPS ?? 500),
    },
    topAgents: (agents ?? [])
      .sort((a, b) => b.uses_total - a.uses_total)
      .slice(0, 10)
      .map(a => ({
        name:         a.name,
        uses:         a.uses_total,
        ownerRevenue: Number(a.revenue_total).toFixed(4),
      })),
    revenueByDay: (revenue ?? []).map(r => ({
      date:          r.date,
      volume:        Number(r.total_volume).toFixed(4),
      platformFees:  Number(r.platform_fees).toFixed(4),
      ownerPayouts:  Number(r.owner_payouts).toFixed(4),
      txCount:       r.tx_count,
    })),
  });
}
