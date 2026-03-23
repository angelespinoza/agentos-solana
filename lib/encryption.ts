/**
 * AgentOS — API Key Encryption Service
 *
 * Encripta las API Keys de los usuarios con AES-256-GCM antes de
 * guardarlas en Supabase. La clave de encriptación nunca sale del servidor.
 *
 * Flujo:
 *   Guardar:  plaintext key → encrypt() → ciphertext en Supabase
 *   Usar:     ciphertext en Supabase → decrypt() → plaintext key (solo en memoria)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM  = "aes-256-gcm";
const IV_LENGTH  = 16;
const TAG_LENGTH = 16;
const SALT       = "agentos-v1"; // salt fijo para derivar la clave

// Clave maestra derivada de ENCRYPTION_SECRET en el env
function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET no configurado");
  return scryptSync(secret, SALT, 32); // 256 bits
}

/**
 * Encripta un texto plano (ej: "sk-ant-xxx")
 * Retorna un string base64 con formato: iv:tag:ciphertext
 */
export function encryptApiKey(plaintext: string): string {
  const key = getMasterKey();
  const iv  = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Formato: base64(iv):base64(tag):base64(ciphertext)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Desencripta un string generado por encryptApiKey()
 * Solo se llama en el momento de ejecutar el agente, nunca se persiste
 */
export function decryptApiKey(ciphertext: string): string {
  const key  = getMasterKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) throw new Error("Formato de ciphertext inválido");

  const iv        = Buffer.from(parts[0], "base64");
  const tag       = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Valida que una API Key tenga el formato correcto antes de guardarla
 */
export function validateApiKey(key: string, provider: LLMProvider): boolean {
  const patterns: Record<LLMProvider, RegExp> = {
    openai:    /^sk-[a-zA-Z0-9\-_]{32,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9\-_]{32,}$/,
    groq:      /^gsk_[a-zA-Z0-9]{32,}$/,
    together:  /^[a-zA-Z0-9]{64}$/,
  };
  return patterns[provider]?.test(key.trim()) ?? false;
}

/**
 * Enmascara una key para mostrarla en la UI (nunca mostrar en texto plano)
 * "sk-ant-api03-abc..." → "sk-ant-api03-abc...••••••••••••••••••"
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return "••••••••••••";
  return key.substring(0, 12) + "••••••••••••••••";
}

export type LLMProvider = "openai" | "anthropic" | "groq" | "together";

export const PROVIDER_MODELS: Record<LLMProvider, { label: string; model: string; costPer1kTokens: number }> = {
  openai:    { label: "OpenAI",    model: "gpt-4o-mini",          costPer1kTokens: 0.00015 },
  anthropic: { label: "Anthropic", model: "claude-haiku-4-5-20251001",   costPer1kTokens: 0.00025 },
  groq:      { label: "Groq",      model: "llama-3.1-8b-instant", costPer1kTokens: 0.000005 },
  together:  { label: "Together",  model: "meta-llama/Llama-3-8b-chat-hf", costPer1kTokens: 0.0002 },
};
