"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "./components/Navbar";
import { AGENT_TEMPLATES } from "../lib/solana/client";

export default function HomePage() {
  const [count, setCount] = useState(0);

  // Contador animado de agentes
  useEffect(() => {
    const target = 127;
    const step = Math.ceil(target / 40);
    const interval = setInterval(() => {
      setCount((c) => {
        if (c + step >= target) { clearInterval(interval); return target; }
        return c + step;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Navbar />
      <main>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ padding: "100px 0 80px", position: "relative", overflow: "hidden" }}>
          {/* Glow bg */}
          <div style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 400,
            background: "radial-gradient(ellipse, rgba(20,241,149,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div className="container">
            <div className="stagger" style={{ maxWidth: 700 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <span className="badge badge-green">
                  <span className="dot-live" />
                  {count} agentes live en Solana
                </span>
                <span className="badge badge-purple">x402 payments</span>
                <span className="badge badge-muted">No-Code</span>
              </div>

              <h1 style={{
                fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                marginBottom: 24,
              }}>
                Agentes de IA<br />
                <span style={{
                  color: "var(--sol-green)",
                  textShadow: "0 0 60px rgba(20,241,149,0.3)",
                }}>
                  que viven en
                </span>
                <br />Solana.
              </h1>

              <p style={{
                color: "var(--text-secondary)",
                fontSize: "1.15rem",
                lineHeight: 1.7,
                maxWidth: 520,
                marginBottom: 36,
              }}>
                Crea, despliega y monetiza agentes de IA sin escribir una línea de código.
                Cada agente vive on-chain y cobra automáticamente vía x402.
              </p>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/builder" className="btn btn-primary" style={{ fontSize: "0.95rem", padding: "14px 28px" }}>
                  ⚡ Crear mi agente
                </Link>
                <Link href="/marketplace" className="btn btn-secondary" style={{ fontSize: "0.95rem", padding: "14px 28px" }}>
                  Ver marketplace →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)" }}>
          <div className="container">
            <div style={{ marginBottom: 48, textAlign: "center" }}>
              <div className="badge badge-muted" style={{ margin: "0 auto 16px" }}>Cómo funciona</div>
              <h2 style={{ fontSize: "2rem", letterSpacing: "-0.03em" }}>
                De idea a agente en <span style={{ color: "var(--sol-green)" }}>4 pasos</span>
              </h2>
            </div>

            <div className="stagger" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 2,
            }}>
              {[
                { step: "01", icon: "🔌", title: "Conecta tu wallet", desc: "Phantom, Backpack o Solflare. Tu wallet = tu identidad on-chain." },
                { step: "02", icon: "🧩", title: "Elige un template", desc: "Respondedor, Monitor DeFi o Agente de Contenido. Sin código." },
                { step: "03", icon: "⚙️", title: "Configura tu agente", desc: "Nombre, conocimiento, precio y tipo de acceso. Todo en un form." },
                { step: "04", icon: "🚀", title: "Deploy en Solana", desc: "Firma una tx y tu agente queda registrado on-chain para siempre." },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: "28px 24px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: i === 0 ? "var(--radius-lg) 0 0 var(--radius-lg)" : i === 3 ? "0 var(--radius-lg) var(--radius-lg) 0" : 0,
                  position: "relative",
                }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.65rem",
                    color: "var(--sol-green)",
                    marginBottom: 16,
                    letterSpacing: "0.1em",
                  }}>
                    PASO {item.step}
                  </div>
                  <div style={{ fontSize: "1.8rem", marginBottom: 12 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{item.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Templates ────────────────────────────────────────────────── */}
        <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)" }}>
          <div className="container">
            <div style={{ marginBottom: 40, textAlign: "center" }}>
              <div className="badge badge-muted" style={{ margin: "0 auto 16px" }}>Templates disponibles</div>
              <h2 style={{ fontSize: "2rem", letterSpacing: "-0.03em" }}>
                Elige tu <span style={{ color: "var(--sol-green)" }}>punto de partida</span>
              </h2>
            </div>

            <div className="stagger" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {AGENT_TEMPLATES.map((t) => (
                <div key={t.id} className="card" style={{ padding: "28px" }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--radius-md)",
                    background: `${t.color}15`,
                    border: `1px solid ${t.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    marginBottom: 20,
                  }}>
                    {t.icon}
                  </div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>{t.name}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 20 }}>
                    {t.description}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge badge-green">desde ${t.defaultPrice} USDC</span>
                    <Link href="/builder" className="btn btn-ghost" style={{ fontSize: "0.75rem" }}>
                      Usar →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── x402 explainer ───────────────────────────────────────────── */}
        <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)" }}>
          <div className="container">
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}>
              <div>
                <div className="badge badge-blue" style={{ marginBottom: 16 }}>x402 Protocol</div>
                <h2 style={{ fontSize: "2rem", letterSpacing: "-0.03em", marginBottom: 16 }}>
                  Pagos<br />
                  <span style={{ color: "var(--sol-blue)" }}>máquina a máquina</span>
                </h2>
                <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>
                  x402 es el estándar abierto de pagos para la era de los agentes. Tu agente cobra automáticamente en USDC
                  cada vez que alguien lo consulta — sin suscripciones, sin intermediarios, sin cuentas.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "35M+ transacciones procesadas en Solana",
                    "$0.00025 por transacción — micropagos viables",
                    "400ms de finalidad — respuesta instantánea",
                    "Facilitador de Coinbase incluido",
                  ].map((item) => (
                    <div key={item} style={{ display: "flex", gap: 10, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--sol-green)" }}>→</span> {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* x402 flow diagram */}
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 24,
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                lineHeight: 2,
              }}>
                {[
                  { arrow: null,  text: "POST /api/agent/{id}/query",         color: "var(--text-secondary)" },
                  { arrow: "←",  text: "402 Payment Required",               color: "#ff8c42" },
                  { arrow: null,  text: '{ amount: 0.01 USDC, payTo: "..." }', color: "var(--text-muted)" },
                  { arrow: "→",  text: "X-PAYMENT: <signed_tx>",             color: "var(--sol-green)" },
                  { arrow: null,  text: "Facilitador verifica on-chain...",   color: "var(--text-muted)" },
                  { arrow: "←",  text: "200 OK + respuesta del agente",      color: "var(--sol-green)" },
                ].map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ width: 16, color: "var(--sol-blue)", textAlign: "center" }}>
                      {line.arrow ?? " "}
                    </span>
                    <span style={{ color: line.color }}>{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <div className="container">
            <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em", marginBottom: 16 }}>
              Tu agente. Tu ownership.<br />
              <span style={{ color: "var(--sol-green)" }}>On-chain para siempre.</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 36, fontSize: "1.05rem" }}>
              Únete a los builders que ya están monetizando IA en Solana.
            </p>
            <Link href="/builder" className="btn btn-primary" style={{ fontSize: "1rem", padding: "16px 36px" }}>
              ⚡ Crear agente gratis
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "24px 0",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
        fontSize: "0.72rem",
        color: "var(--text-muted)",
      }}>
        <div className="container">
          ◈ AgentOS — Built on Solana · Powered by x402 · No-Code AI Agents
        </div>
      </footer>
    </>
  );
}
