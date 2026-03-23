"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "../../components/Navbar";
import { AgentChatModal } from "../../components/AgentChatModal";
import { AGENT_TEMPLATES } from "../../../lib/solana/client";
import { getTxUrl, getAddressUrl } from "../../../lib/network";
import type { Agent } from "../../marketplace/page";

const PROVIDER_LABELS: Record<string, string> = {
  openai:    "OpenAI",
  anthropic: "Anthropic",
  groq:      "Groq",
  together:  "Together AI",
};

export default function AgentPage({ params }: { params: { agentId: string } }) {
  const { publicKey } = useWallet();
  const [agent, setAgent]       = useState<(Agent & { llm_provider?: string; has_own_key?: boolean }) | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    fetch(`/api/agent/${params.agentId}/query`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        // Normalizar campos del GET response al formato Agent
        setAgent({
          agent_id:      d.agentId,
          name:          d.name,
          template:      d.template,
          price_usdc:    d.priceUsdc,
          access_type:   d.accessType,
          uses_total:    d.stats?.usesTotal ?? 0,
          revenue_total: d.stats?.revenueTotal ?? 0,
          created_at:    d.createdAt,
          owner:         "",
          llm_provider:  d.llmProvider,
          has_own_key:   d.hasOwnKey,
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.agentId]);

  const copyEndpoint = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/api/agent/${params.agentId}/query`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingState />;
  if (notFound || !agent) return <NotFoundState />;

  const template = AGENT_TEMPLATES.find((t) => t.id === agent.template) ?? AGENT_TEMPLATES[0];
  const isOwner  = publicKey?.toBase58() === agent.owner;

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingBottom: 80 }}>

        {/* Hero del agente */}
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, rgba(20,241,149,0.03) 0%, transparent 100%)",
          paddingBottom: 40,
        }}>
          <div className="container" style={{ paddingTop: 48 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>

              {/* Avatar */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: "var(--radius-lg)",
                background: `${template.color}15`,
                border: `2px solid ${template.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.5rem",
                flexShrink: 0,
              }}>
                {template.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span className="badge badge-green">
                    <span className="dot-live" />
                    Live on Solana
                  </span>
                  <span className="badge badge-muted">{template.name}</span>
                  {agent.access_type === 1 && <span className="badge badge-purple">🎫 NFT-Gated</span>}
                  {agent.has_own_key && <span className="badge badge-blue">🔑 Key propia</span>}
                </div>

                <h1 style={{
                  fontSize: "clamp(1.8rem, 4vw, 3rem)",
                  letterSpacing: "-0.03em",
                  marginBottom: 8,
                  wordBreak: "break-word",
                }}>
                  {agent.name}
                </h1>

                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginBottom: 20,
                }}>
                  ID: {params.agentId}
                </div>

                {/* CTA */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowChat(true)}
                    style={{ fontSize: "0.95rem", padding: "12px 24px" }}
                  >
                    ◈ Consultar agente
                    {agent.price_usdc > 0 && (
                      <span style={{ marginLeft: 8, opacity: 0.8 }}>
                        · ${agent.price_usdc} USDC
                      </span>
                    )}
                  </button>

                  {!publicKey && (
                    <WalletMultiButton />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats + Info */}
        <div className="container" style={{ paddingTop: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>

            {/* Left: stats + endpoint */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Precio por consulta",  value: agent.price_usdc === 0 ? "Gratis" : `$${agent.price_usdc} USDC`, accent: "var(--sol-green)" },
                  { label: "Total de consultas",   value: agent.uses_total.toLocaleString(),           accent: "var(--sol-blue)" },
                  { label: "Revenue generado",     value: `$${(agent.revenue_total ?? 0).toFixed(3)}`, accent: "var(--sol-yellow)" },
                ].map((s) => (
                  <div key={s.label} className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      {s.label}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", fontWeight: 700, color: s.accent }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Endpoint público */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Endpoint x402</h3>
                  <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>REST API</span>
                </div>

                <div style={{
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  color: "var(--sol-green)",
                  marginBottom: 12,
                  wordBreak: "break-all",
                }}>
                  POST /api/agent/{params.agentId}/query
                </div>

                <button onClick={copyEndpoint} className="btn btn-secondary" style={{ fontSize: "0.78rem", width: "100%", justifyContent: "center" }}>
                  {copied ? "✓ Copiado" : "Copiar endpoint"}
                </button>

                {/* Ejemplo de uso */}
                <div style={{ marginTop: 20 }}>
                  <div className="form-label" style={{ marginBottom: 10 }}>Ejemplo de uso</div>
                  <pre style={{
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-sm)",
                    padding: 16,
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.7rem",
                    color: "var(--text-secondary)",
                    overflowX: "auto",
                    lineHeight: 1.7,
                  }}>
{`# Sin pago (si es gratis)
curl -X POST /api/agent/${params.agentId}/query \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hola, ¿qué puedes hacer?"}'

# Con pago x402 (automático si usas x402-solana SDK)
import { createX402Client } from 'x402-solana/client'
const client = createX402Client({ wallet, network: 'solana-devnet' })
const res = await client.fetch('/api/agent/${params.agentId}/query', {
  method: 'POST',
  body: JSON.stringify({ message: 'Tu pregunta aquí' })
})`}
                  </pre>
                </div>
              </div>

              {/* Modelo LLM */}
              {agent.llm_provider && (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>Modelo de IA</div>
                      <div style={{ fontWeight: 600 }}>{PROVIDER_LABELS[agent.llm_provider] ?? agent.llm_provider}</div>
                    </div>
                    <span className={`badge ${agent.has_own_key ? "badge-blue" : "badge-green"}`}>
                      {agent.has_own_key ? "🔑 Key propia" : "⚡ Key AgentOS"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: info lateral */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Detalles */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 16 }}>Detalles</h3>
                {[
                  { label: "Template",    value: template.name },
                  { label: "Acceso",      value: agent.access_type === 0 ? "Público" : "NFT-Gated" },
                  { label: "Pagos",       value: "x402 · USDC" },
                  { label: "Red",         value: "Solana Devnet" },
                  { label: "Creado",      value: new Date(agent.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }) },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "0.85rem",
                  }}>
                    <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{item.label}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Owner (si es el dueño) */}
              {isOwner && (
                <div style={{
                  padding: 16,
                  background: "rgba(20,241,149,0.05)",
                  border: "1px solid rgba(20,241,149,0.2)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                }}>
                  <div style={{ color: "var(--sol-green)", fontWeight: 600, marginBottom: 8 }}>◈ Eres el owner</div>
                  <a href="/dashboard" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", fontSize: "0.78rem" }}>
                    Gestionar en Dashboard →
                  </a>
                </div>
              )}

              {/* Share */}
              <div className="card" style={{ padding: 20 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>Compartir agente</div>
                <div style={{
                  display: "flex",
                  gap: 8,
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.68rem",
                  color: "var(--text-secondary)",
                  wordBreak: "break-all",
                  marginBottom: 10,
                }}>
                  {typeof window !== "undefined" ? window.location.href : `/agent/${params.agentId}`}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.78rem", width: "100%", justifyContent: "center" }}
                >
                  Copiar URL
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showChat && (
        <AgentChatModal agent={agent} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <>
      <Navbar />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Cargando agente...
        </div>
      </div>
    </>
  );
}

function NotFoundState() {
  return (
    <>
      <Navbar />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>◈</div>
          <h2 style={{ marginBottom: 8 }}>Agente no encontrado</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: "0.9rem" }}>
            Este agente no existe o fue dado de baja.
          </p>
          <a href="/marketplace" className="btn btn-primary">Ver marketplace →</a>
        </div>
      </div>
    </>
  );
}
