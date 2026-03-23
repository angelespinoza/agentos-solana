import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const Schema = z.object({
  status: z.enum(["active", "paused"]),
  owner:  z.string().min(32),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 422 });
  }

  const { status, owner } = parsed.data;

  // Verificar que el owner es quien dice ser
  const { data: agent } = await supabase
    .from("agents")
    .select("owner")
    .eq("agent_id", params.agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
  }

  if (agent.owner !== owner) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { error } = await supabase
    .from("agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("agent_id", params.agentId);

  if (error) {
    return NextResponse.json({ error: "Error al actualizar el agente" }, { status: 500 });
  }

  return NextResponse.json({ success: true, agentId: params.agentId, status });
}
