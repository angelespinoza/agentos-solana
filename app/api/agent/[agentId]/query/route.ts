import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { agentQueryHandler } from "../../../../../lib/x402-middleware";
import { routeLLMRequest, LLMMessage } from "../../../../../lib/llm-router";
import type { LLMProvider } from "../../../../../lib/encryption";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { data: agent } = await supabase
    .from("agents")
    .select("agent_id, name, template, price_usdc, access_type, uses_total, revenue_total, created_at, llm_provider, has_own_key")
    .eq("agent_id", params.agentId)
    .eq("status", "active")
    .single();

  if (!agent) return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });

  return NextResponse.json({
    agentId:     agent.agent_id,
    name:        agent.name,
    template:    agent.template,
    priceUsdc:   agent.price_usdc,
    accessType:  agent.access_type,
    llmProvider: agent.llm_provider,
    hasOwnKey:   agent.has_own_key,
    stats:       { usesTotal: agent.uses_total, revenueTotal: agent.revenue_total },
    endpoint:    `/api/agent/${agent.agent_id}/query`,
    createdAt:   agent.created_at,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

  const gatewayResponse = await agentQueryHandler(req, agentId);
  if (gatewayResponse) return gatewayResponse;

  let body: { message: string; history?: { role: string; content: string }[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  if (!body.message?.trim()) return NextResponse.json({ error: "'message' requerido" }, { status: 400 });

  const { data: agent } = await supabase
    .from("agents")
    .select("system_prompt, name, llm_provider, encrypted_api_key, has_own_key")
    .eq("agent_id", agentId)
    .single();

  if (!agent) return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });

  const messages: LLMMessage[] = [
    { role: "system", content: agent.system_prompt },
    ...(body.history ?? []).slice(-8).map(m => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user", content: body.message },
  ];

  try {
    const startMs = Date.now();
    const { stream, estimatedCost, usingPlatformKey } = await routeLLMRequest(
      { provider: (agent.llm_provider ?? "openai") as LLMProvider, encryptedApiKey: agent.encrypted_api_key ?? null },
      messages
    );

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          for await (const delta of stream) {
            fullResponse += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
          const latencyMs = Date.now() - startMs;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, response: fullResponse, estimatedCost, usingPlatformKey, latencyMs })}\n\n`));
          await Promise.all([
            supabase.rpc("increment_agent_uses", { agent_id_param: agentId }),
            supabase.from("agent_queries").insert({ agent_id: agentId, user_message: body.message, response: fullResponse, latency_ms: latencyMs, created_at: new Date().toISOString() }),
          ]);
        } finally { controller.close(); }
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Using-Own-Key": String(!usingPlatformKey),
        "X-PAYMENT-RESPONSE": "settled",
      },
    });

  } catch (err: any) {
    if (err.status === 401) return NextResponse.json({ error: "API Key del agente inválida. El owner debe actualizarla." }, { status: 503 });
    return NextResponse.json({ error: "Error al procesar la consulta" }, { status: 500 });
  }
}
