/**
 * AgentOS — LLM Router
 *
 * Modelo híbrido:
 *   - Usuario con key propia → usa su key, cualquier precio
 *   - Usuario sin key        → usa la key de AgentOS + markup automático
 *
 * Soporta: OpenAI, Anthropic, Groq, Together
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { decryptApiKey, LLMProvider, PROVIDER_MODELS } from "./encryption";

// ── Markup config ─────────────────────────────────────────────────────────

const PLATFORM_TOKEN_MARKUP = 3.0; // 3x sobre el costo real (cubre infra + margen)
const MIN_PRICE_PLATFORM    = 0; // $0.005 USDC mínimo si usan key de AgentOS

// ── Types ─────────────────────────────────────────────────────────────────

export interface AgentLLMConfig {
  provider:          LLMProvider;
  encryptedApiKey:   string | null;  // null = usar key de AgentOS
  model?:            string;         // override del modelo si el usuario quiere
}

export interface LLMMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  stream:        AsyncIterable<string>;
  estimatedCost: number;             // costo estimado en USDC
  usingPlatformKey: boolean;
}

// ── Precio mínimo calculado ────────────────────────────────────────────────

export function calcMinimumPrice(provider: LLMProvider): number {
  // Si el usuario usa key de AgentOS, el precio mínimo del agente debe cubrir
  // el costo promedio de tokens * markup
  const avgTokensPerQuery = 500; // estimado conservador
  const costPerQuery = (PROVIDER_MODELS[provider].costPer1kTokens * avgTokensPerQuery) / 1000;
  return 0;
}

// ── Main router ───────────────────────────────────────────────────────────

export async function routeLLMRequest(
  config: AgentLLMConfig,
  messages: LLMMessage[],
  maxTokens = 1024
): Promise<LLMResponse> {

  const usingPlatformKey = !config.encryptedApiKey;
  const providerMeta     = PROVIDER_MODELS[config.provider];
  const model            = config.model ?? providerMeta.model;

  // Resolver la API key a usar
  const apiKey = usingPlatformKey
    ? getPlatformKey(config.provider)
    : decryptApiKey(config.encryptedApiKey!);

  // Estimar el costo
  const estimatedTokens  = estimateTokens(messages) + maxTokens;
  const rawCost          = (providerMeta.costPer1kTokens * estimatedTokens) / 1000;
  const estimatedCost    = usingPlatformKey ? rawCost * PLATFORM_TOKEN_MARKUP : rawCost;

  // Enrutar al proveedor correcto
  let stream: AsyncIterable<string>;

  switch (config.provider) {
    case "openai":
    case "groq":
    case "together":
      stream = await streamOpenAICompatible({ apiKey, model, messages, maxTokens, provider: config.provider });
      break;
    case "anthropic":
      stream = await streamAnthropic({ apiKey, model, messages, maxTokens });
      break;
    default:
      throw new Error(`Proveedor no soportado: ${config.provider}`);
  }

  return { stream, estimatedCost, usingPlatformKey };
}

// ── OpenAI-compatible (OpenAI, Groq, Together) ────────────────────────────

async function streamOpenAICompatible(params: {
  apiKey:   string;
  model:    string;
  messages: LLMMessage[];
  maxTokens: number;
  provider: LLMProvider;
}): Promise<AsyncIterable<string>> {
  const baseURLs: Partial<Record<LLMProvider, string>> = {
    groq:     "https://api.groq.com/openai/v1",
    together: "https://api.together.xyz/v1",
  };

  const client = new OpenAI({
    apiKey:  params.apiKey,
    baseURL: baseURLs[params.provider],
  });

  const response = await client.chat.completions.create({
    model:       params.model,
    messages:    params.messages as any,
    max_tokens:  params.maxTokens,
    temperature: 0.7,
    stream:      true,
  });

  return (async function* () {
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  })();
}

// ── Anthropic ────────────────────────────────────────────────────────────

async function streamAnthropic(params: {
  apiKey:    string;
  model:     string;
  messages:  LLMMessage[];
  maxTokens: number;
}): Promise<AsyncIterable<string>> {
  const client = new Anthropic({ apiKey: params.apiKey });

  // Separar el system prompt del resto de mensajes
  const systemMsg = params.messages.find(m => m.role === "system")?.content ?? "";
  const chatMsgs  = params.messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = await client.messages.create({
    model:      params.model,
    max_tokens: params.maxTokens,
    system:     systemMsg,
    messages:   chatMsgs,
    stream:     true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  })();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getPlatformKey(provider: LLMProvider): string {
  const keys: Record<LLMProvider, string | undefined> = {
    openai:    process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq:      process.env.GROQ_API_KEY,
    together:  process.env.TOGETHER_API_KEY,
  };
  const key = keys[provider];
  if (!key) throw new Error(`No hay key de plataforma para ${provider}`);
  return key;
}

function estimateTokens(messages: LLMMessage[]): number {
  // Estimación rápida: ~4 chars por token
  const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}
