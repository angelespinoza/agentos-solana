"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "../components/Navbar";
import { AgentCard } from "../components/AgentCard";
import { Agent } from "../marketplace/page";

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents?owner=${publicKey.toBase58()}&limit=50`);
      const data = await res.json();
      setAgents(data.agents ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, [publicKey]);

  // ── Stats totales ──────────────────────────────────────────────────────
  const totalUses    = agents.reduce((s, a) => s + a.uses_total, 0);
  const totalRevenue = agents.reduce((s, a) => s + (a.revenue_total ?? 0), 0);
  const activeAgents = agents.filter((a) => true).length; // todos activos por ahora

  if (!connected) {
    return (
      <>
        <Navbar />
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>◈</div>
            <h2 style={{ marginBottom: 12 }}>Conecta tu wallet</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
              Para ver y gestionar tus agentes necesitas conectar tu wallet de Solana.
            </p>
            <WalletMultiButton />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingBottom: 80 }}>
        <div className="container" style={{ paddingTop: 48 }}>

          {/* Header */}
          <div className="stagger" style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="badge badge-green">Dashboard</span>
              <span className="badge badge-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>
                {publicKey?.toBase58().substring(0, 8)}...
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.03em" }}>
              Mis <span style={{ color: "var(--sol-green)" }}>Agentes</span>
            </h1>
          </div>

          {/* Stats overview */}
          <div
            className="stagger dashboard-stats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 40,
            }}
          >
            <StatCard label="Agentes activos" value={activeAgents} icon="◈" accent="var(--sol-green)" />
            <StatCard label="Consultas totales" value={totalUses.toLocaleString()} icon="⚡" accent="var(--sol-blue)" />
            <StatCard label="Revenue total" value={`$${totalRevenue.toFixed(3)} USDC`} icon="💰" accent="var(--sol-yellow)" />
            <StatCard
              label="Precio promedio"
              value={agents.length ? `$${(agents.reduce((s,a) => s + a.price_usdc, 0) / agents.length).toFixed(3)}` : "$0"}
              icon="📊"
              accent="var(--sol-purple)"
            />
          </div>

          {/* Agents grid */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>
              {agents.length} {agents.length === 1 ? "agente" : "agentes"}
            </h2>
            <a href="/builder" className="btn btn-primary" style={{ fontSize: "0.8rem" }}>
              + Nuevo agente
            </a>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Cargando agentes...
            </div>
          ) : agents.length === 0 ? (
            <EmptyDashboard />
          ) : (
            <div
              className="stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
              }}
            >
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  currentWallet={publicKey?.toBase58()}
                  showOwnerActions={true}
                  onPause={() => handlePause(agent.agent_id)}
                />
              ))}
            </div>
          )}

          {/* Agent endpoints table */}
          {agents.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: 16, fontWeight: 600 }}>
                Endpoints x402
              </h2>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Agente", "Endpoint", "Precio", "Usos", "Revenue"].map((h) => (
                        <th key={h} style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent, i) => (
                      <tr
                        key={agent.agent_id}
                        style={{
                          borderBottom: i < agents.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "0.9rem" }}>
                          {agent.name}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <code style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.72rem",
                            color: "var(--sol-green)",
                            background: "rgba(20,241,149,0.07)",
                            padding: "3px 8px",
                            borderRadius: 4,
                          }}>
                            /api/agent/{agent.agent_id}/query
                          </code>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--sol-green)" }}>
                          {agent.price_usdc === 0 ? "Gratis" : `$${agent.price_usdc} USDC`}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                          {agent.uses_total.toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--sol-blue)" }}>
                          ${(agent.revenue_total ?? 0).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );

  async function handlePause(agentId: string) {
    await fetch(`/api/agents/${agentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused", owner: publicKey?.toBase58() }),
    });
    await fetchAgents();
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: {
  label: string; value: string | number; icon: string; accent: string;
}) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div style={{ fontSize: "1.4rem", marginBottom: 10 }}>{icon}</div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "1.4rem",
        fontWeight: 700,
        color: accent,
        marginBottom: 4,
        letterSpacing: "-0.02em",
      }}>
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div style={{
      textAlign: "center",
      padding: "80px 24px",
      border: "1px dashed var(--border)",
      borderRadius: "var(--radius-lg)",
    }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>◈</div>
      <h3 style={{ marginBottom: 8, color: "var(--text-secondary)" }}>Aún no tienes agentes</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 28, maxWidth: 340, margin: "0 auto 28px" }}>
        Crea tu primer agente de IA en Solana. Sin código. En menos de 5 minutos.
      </p>
      <a href="/builder" className="btn btn-primary">
        ⚡ Crear mi primer agente
      </a>
    </div>
  );
}
