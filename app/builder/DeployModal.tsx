"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AgentConfig } from "./page";
import { AutonomyConfig } from "./StepAutonomy";
import { buildSystemPrompt } from "./helpers";;
import { createHash } from "crypto";

type DeployStatus = "idle" | "saving" | "signing" | "confirming" | "done" | "error";

interface DeployModalProps {
  config: AgentConfig;
  autonomy: AutonomyConfig;
  onClose: () => void;
}

export function DeployModal({ config, autonomy, onClose }: DeployModalProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [status, setStatus] = useState<DeployStatus>("idle");
  const [txSignature, setTxSignature] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleDeploy = async () => {
    if (!publicKey) return;

    try {
      // ── Paso 1: Guardar config en Supabase ────────────────────────────
      setStatus("saving");

      const systemPrompt = buildSystemPrompt(config);
      const configHash = createHash("sha256").update(systemPrompt).digest("hex");
      const newAgentId = Date.now().toString();

      const saveRes = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: newAgentId,
          owner: publicKey.toBase58(),
          name: config.name,
          template: config.template,
          toneIndex: config.toneIndex,
          language: config.language,
          systemPrompt,
          configHash,
          priceUsdc: config.priceUsdc,
          accessType: config.accessType,
          nftCollection: config.nftCollection || null,
          autonomous_enabled: autonomy.enabled,
          autonomous_config: autonomy.enabled ? autonomy : null,
          // LLM config
          llmProvider: config.llmProvider,
          useOwnKey:   config.useOwnKey,
          ownApiKey:   config.useOwnKey ? config.ownApiKey : undefined,
        }),
      });

      if (!saveRes.ok) { const err = await saveRes.json(); throw new Error(err.error || "Error al guardar"); }

      // ── Paso 2: Crear transacción on-chain ────────────────────────────
      setStatus("signing");

      const buildRes = await fetch("/api/agents/build-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: newAgentId,
          owner: publicKey.toBase58(),
          name: config.name,
          template: config.template,
          priceUsdc: config.priceUsdc,
          accessType: config.accessType,
          nftCollection: config.nftCollection || null,
          autonomous_enabled: autonomy.enabled,
          autonomous_config: autonomy.enabled ? autonomy : null,
          configHash: Array.from(Buffer.from(configHash, "hex")),
        }),
      });

      if (!buildRes.ok) throw new Error("Error al construir la transacción");

      const { transaction: serializedTx } = await buildRes.json();

      // Deserializar y firmar
      const { Transaction } = await import("@solana/web3.js");
      const tx = Transaction.from(Buffer.from(serializedTx, "base64"));

      // ── Paso 3: Enviar y confirmar ────────────────────────────────────
      setStatus("confirming");

      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");

      // ── Done ──────────────────────────────────────────────────────────
      setTxSignature(signature);
      setAgentId(newAgentId);
      setStatus("done");

    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error desconocido");
      setStatus("error");
    }
  };

  return (
    <div style={{
      position: "fixed",
      zIndex: 9999,
      inset: 0,
      background: "rgba(8,11,16,0.92)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      padding: 24,
    }}>
      <div className="card card-glow animate-fade-up" style={{ maxWidth: 480, width: "100%", padding: 32 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Deploy en Solana</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Tu agente <strong style={{ color: "var(--text-primary)" }}>{config.name}</strong> será registrado on-chain.
            </p>
          </div>
          {status !== "signing" && status !== "confirming" && (
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
          )}
        </div>

        {/* Status steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {[
            { key: "saving",     label: "Guardando configuración",      icon: "💾" },
            { key: "signing",    label: "Esperando firma de wallet",    icon: "✍️" },
            { key: "confirming", label: "Confirmando en Solana",        icon: "⛓️" },
            { key: "done",       label: "Agente desplegado",            icon: "🚀" },
          ].map((s, i) => {
            const states = ["saving", "signing", "confirming", "done"];
            const currentIdx = states.indexOf(status);
            const stepIdx = states.indexOf(s.key);
            const isDone = currentIdx > stepIdx || status === "done";
            const isActive = status === s.key;

            return (
              <div key={s.key} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: isActive ? "rgba(20,241,149,0.05)" : isDone ? "rgba(20,241,149,0.02)" : "var(--bg-elevated)",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${isActive ? "rgba(20,241,149,0.3)" : isDone ? "rgba(20,241,149,0.15)" : "var(--border)"}`,
                transition: "all 0.3s",
              }}>
                <span style={{ fontSize: "1.2rem" }}>
                  {isDone ? "✅" : isActive ? "⏳" : s.icon}
                </span>
                <span style={{
                  fontSize: "0.85rem",
                  color: isActive ? "var(--sol-green)" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {s.label}
                </span>
                {isActive && (
                  <span style={{
                    marginLeft: "auto",
                    width: 16,
                    height: 16,
                    border: "2px solid var(--sol-green)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Done state */}
        {status === "done" && (
          <div className="animate-fade-in" style={{
            padding: 20,
            background: "rgba(20,241,149,0.05)",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(20,241,149,0.3)",
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>🎉 ¡Agente desplegado!</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Endpoint:</span>{" "}
                <span style={{ color: "var(--sol-green)" }}>
                  /api/agent/{agentId}/query
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>TX:</span>{" "}
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--sol-blue)", textDecoration: "none" }}
                >
                  {txSignature.substring(0, 20)}...
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="animate-fade-in" style={{
            padding: 16,
            background: "rgba(255,80,80,0.05)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(255,80,80,0.3)",
            marginBottom: 20,
            fontSize: "0.85rem",
            color: "#ff8080",
            fontFamily: "var(--font-mono)",
          }}>
            ✕ {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          {status === "idle" && (
            <>
              <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleDeploy} style={{ flex: 2 }}>
                ⚡ Confirmar Deploy
              </button>
            </>
          )}

          {status === "done" && (
            <>
              <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cerrar
              </button>
              <a
                href="/dashboard"
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: "center" }}
              >
                Ver mis Agentes →
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => { setStatus("idle"); setError(""); }} style={{ flex: 1 }}>
                Reintentar
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
