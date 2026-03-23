"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Agent } from "../marketplace/page";
import { AGENT_TEMPLATES } from "../../lib/solana/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentChatModalProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentChatModal({ agent, onClose }: AgentChatModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const template = AGENT_TEMPLATES.find((t) => t.id === agent.template) ?? AGENT_TEMPLATES[0];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "paying" | "paid" | "error">("idle");
  const [totalSpent, setTotalSpent] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!publicKey) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // ── Paso 1: Primera llamada → puede retornar 402 ─────────────────
      setPaymentStatus("idle");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-WALLET-ADDRESS": publicKey.toBase58(),
      };

      let res = await fetch(`/api/agent/${agent.agent_id}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6),
        }),
      });

      // ── Paso 2: Si el server pide pago (402), construir y enviar ─────
      if (res.status === 402 && agent.price_usdc > 0) {
        setPaymentStatus("paying");

        const paymentReqs = await res.json();
        const requirements = paymentReqs.accepts?.[0];

        if (!requirements) throw new Error("No se recibieron requisitos de pago");

        // Llamar a nuestro API para construir la tx de pago
        const payRes = await fetch("/api/x402/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirements,
            walletAddress: publicKey.toBase58(),
          }),
        });

        if (!payRes.ok) throw new Error("Error al construir el pago");
        const { transaction: serializedTx } = await payRes.json();

        // Firmar la transacción con la wallet
        const { Transaction } = await import("@solana/web3.js");
        const tx = Transaction.from(Buffer.from(serializedTx, "base64"));
        const signed = await signTransaction!(tx);
        const signedB64 = signed.serialize().toString("base64");

        // Construir el header X-PAYMENT
        const payment = {
          x402Version: 1,
          scheme: "exact",
          network: "solana:devnet",
          payload: {
            signature: signedB64,
            transaction: serializedTx,
          },
        };

        const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");

        // ── Paso 3: Reintentar con el pago ────────────────────────────
        res = await fetch(`/api/agent/${agent.agent_id}/query`, {
          method: "POST",
          headers: {
            ...headers,
            "X-PAYMENT": paymentHeader,
          },
          body: JSON.stringify({
            message: userMessage,
            history: messages.slice(-6),
          }),
        });

        setPaymentStatus("paid");
        setTotalSpent((prev) => prev + agent.price_usdc);
      }

      if (!res.ok) throw new Error("Error al consultar el agente");

      // ── Paso 4: Leer el streaming SSE ─────────────────────────────────
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              fullResponse += data.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResponse };
                return updated;
              });
            }
          } catch { /* skip malformed */ }
        }
      }

    } catch (err: any) {
      setPaymentStatus("error");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${err.message ?? "Error desconocido"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8,11,16,0.92)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
      padding: 24,
    }}>
      <div className="card animate-fade-up" style={{
        maxWidth: 600,
        width: "100%",
        height: "80vh",
        maxHeight: 680,
        display: "flex",
        flexDirection: "column",
        padding: 0,
        overflow: "hidden",
        borderColor: `${template.color}30`,
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ fontSize: "1.5rem" }}>{template.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{agent.name}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span className="badge badge-green" style={{ fontSize: "0.6rem" }}>
                <span className="dot-live" style={{ width: 6, height: 6 }} />
                Live on Solana
              </span>
              {agent.price_usdc > 0 && (
                <span className="badge badge-muted" style={{ fontSize: "0.6rem" }}>
                  ${agent.price_usdc} USDC / consulta · x402
                </span>
              )}
              {totalSpent > 0 && (
                <span className="badge badge-purple" style={{ fontSize: "0.6rem" }}>
                  Gastado: ${totalSpent.toFixed(3)} USDC
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>{template.icon}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>
                Hola, soy <strong style={{ color: "var(--text-primary)" }}>{agent.name}</strong>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                {agent.price_usdc === 0
                  ? "Este agente es gratuito. ¡Pregúntame lo que quieras!"
                  : `Cada consulta cuesta $${agent.price_usdc} USDC, pagado automáticamente via x402.`}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 16,
              }}
            >
              <div style={{
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: msg.role === "user"
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                background: msg.role === "user"
                  ? "rgba(20,241,149,0.12)"
                  : "var(--bg-elevated)",
                border: `1px solid ${msg.role === "user" ? "rgba(20,241,149,0.25)" : "var(--border)"}`,
                fontSize: "0.875rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {msg.content}
                {msg.role === "assistant" && loading && i === messages.length - 1 && (
                  <span style={{
                    display: "inline-block",
                    width: 8,
                    height: 14,
                    background: "var(--sol-green)",
                    marginLeft: 4,
                    animation: "blink 1s step-end infinite",
                    verticalAlign: "text-bottom",
                  }} />
                )}
              </div>
            </div>
          ))}

          {/* Payment status indicator */}
          {paymentStatus === "paying" && (
            <div style={{
              textAlign: "center",
              padding: "10px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--sol-green)",
            }}>
              ⏳ Procesando pago x402...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          background: "var(--bg-card)",
        }}>
          {!publicKey ? (
            <div style={{
              flex: 1,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              padding: "10px",
            }}>
              Conecta tu wallet para consultar este agente
            </div>
          ) : (
            <>
              <input
                className="form-input"
                placeholder={`Pregunta a ${agent.name}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{ padding: "10px 16px", flexShrink: 0 }}
              >
                {loading ? "..." : "→"}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}
