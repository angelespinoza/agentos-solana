import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { encryptApiKey, validateApiKey } from "../../../lib/encryption";
import { calcMinimumPrice } from "../../../lib/llm-router";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const CreateAgentSchema = z.object({
  agentId:       z.string().min(1),
  owner:         z.string().min(32),
  name:          z.string().min(3).max(50),
  template:      z.number().int().min(0).max(2),
  toneIndex:     z.number().int().min(0).max(4),
  language:      z.string(),
  systemPrompt:  z.string().min(10),
  configHash:    z.string().length(64),
  priceUsdc:     z.number().min(0),
  accessType:    z.number().int().min(0).max(1),
  nftCollection: z.string().nullable().optional(),
  llmProvider:   z.enum(["openai", "anthropic", "groq", "together"]).default("openai"),
  ownApiKey:     z.string().optional(),
  useOwnKey:     z.boolean().default(false),
  autonomous_enabled: z.boolean().default(false),
  autonomous_config:  z.any().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  let encryptedKey: string | null = null;

  if (data.useOwnKey && data.ownApiKey) {
    if (!validateApiKey(data.ownApiKey, data.llmProvider)) {
      return NextResponse.json({ error: `Formato de API Key invalido para ${data.llmProvider}` }, { status: 422 });
    }
    encryptedKey = encryptApiKey(data.ownApiKey);
  }

  if (!data.useOwnKey) {
    const minPrice = calcMinimumPrice(data.llmProvider);
    if (data.priceUsdc < minPrice) {
      return NextResponse.json({ error: `Precio minimo: $${minPrice.toFixed(4)} USDC` }, { status: 422 });
    }
  }

  const paymentKeypair = Keypair.generate();
  const paymentWallet  = paymentKeypair.publicKey.toBase58();

  const { error } = await supabase.from("agents").insert({
    agent_id:          data.agentId,
    owner:             data.owner,
    name:              data.name,
    template:          data.template,
    tone_index:        data.toneIndex,
    language:          data.language,
    system_prompt:     data.systemPrompt,
    config_hash:       data.configHash,
    price_usdc:        data.priceUsdc,
    access_type:       data.accessType,
    nft_collection:    data.nftCollection ?? null,
    payment_wallet:    paymentWallet,
    llm_provider:      data.llmProvider,
    encrypted_api_key: encryptedKey,
    has_own_key:       data.useOwnKey,
    status:            "active",
    uses_total:        0,
    revenue_total:     0,
    created_at:        new Date().toISOString(),
    autonomous_enabled: data.autonomous_enabled ?? false,
    autonomous_config:  data.autonomous_config ?? null,
  });

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Error al guardar el agente" }, { status: 500 });
  }

  return NextResponse.json({
    success:     true,
    agentId:     data.agentId,
    paymentWallet,
    hasOwnKey:   data.useOwnKey,
    llmProvider: data.llmProvider,
    endpoint:    `/api/agent/${data.agentId}/query`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner  = searchParams.get("owner");
  const limit  = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("agents")
    .select("agent_id, name, template, price_usdc, access_type, uses_total, revenue_total, created_at, owner, llm_provider, has_own_key")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (owner) query = query.eq("owner", owner);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Error al obtener agentes" }, { status: 500 });

  return NextResponse.json({ agents: data, total: data?.length ?? 0 });
}
