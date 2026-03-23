"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navbar } from "../components/Navbar";
import { AGENT_TEMPLATES } from "../../lib/solana/client";
import { AgentCard } from "../components/AgentCard";

const TEMPLATE_FILTERS = [
  { label: "Todos", value: -1 },
  { label: "🤖 Respondedor", value: 0 },
  { label: "📈 DeFi Monitor", value: 1 },
  { label: "📢 Contenido", value: 2 },
];

const ACCESS_FILTERS = [
  { label: "Todos", value: -1 },
  { label: "🌐 Público", value: 0 },
  { label: "🎫 NFT-Gated", value: 1 },
];

export interface Agent {
  agent_id: string;
  name: string;
  template: number;
  price_usdc: number;
  access_type: number;
  uses_total: number;
  revenue_total: number;
  created_at: string;
  owner: string;
}

export default function MarketplacePage() {
  const { publicKey } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateFilter, setTemplateFilter] = useState(-1);
  const [accessFilter, setAccessFilter] = useState(-1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "cheap">("newest");

  useEffect(() => {
    fetch("/api/agents?limit=50")
      .then((r) => r.json())
      .then((d) => { setAgents(d.agents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = agents
    .filter((a) => templateFilter === -1 || a.template === templateFilter)
    .filter((a) => accessFilter === -1 || a.access_type === accessFilter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "popular") return b.uses_total - a.uses_total;
      if (sortBy === "cheap")   return a.price_usdc - b.price_usdc;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingBottom: 80 }}>
        <div className="container" style={{ paddingTop: 48 }}>

          {/* Header */}
          <div className="stagger" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="badge badge-green">
                <span className="dot-live" />
                {agents.length} agentes live
              </span>
              <span className="badge badge-purple">Solana Devnet</span>
            </div>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
              Agent <span style={{ color: "var(--sol-green)" }}>Marketplace</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 12, maxWidth: 520 }}>
              Agentes de IA desplegados on-chain por la comunidad. Cada consulta paga automáticamente vía x402.
            </p>
          </div>

          {/* Filters bar */}
          <div style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 32,
            padding: "16px 20px",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}>
            {/* Search */}
            <input
              className="form-input"
              placeholder="Buscar agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, padding: "8px 14px", fontSize: "0.85rem" }}
            />

            <div className="divider" style={{ width: 1, height: 28, margin: "0 4px" }} />

            {/* Template filter */}
            <div style={{ display: "flex", gap: 6 }}>
              {TEMPLATE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTemplateFilter(f.value)}
                  className={`btn ${templateFilter === f.value ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="divider" style={{ width: 1, height: 28, margin: "0 4px" }} />

            {/* Access filter */}
            <div style={{ display: "flex", gap: 6 }}>
              {ACCESS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAccessFilter(f.value)}
                  className={`btn ${accessFilter === f.value ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ marginLeft: "auto", width: "auto", padding: "8px 14px", fontSize: "0.8rem" }}
            >
              <option value="newest">Más recientes</option>
              <option value="popular">Más usados</option>
              <option value="cheap">Más baratos</option>
            </select>
          </div>

          {/* Grid */}
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="stagger marketplace-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
              }}
            >
              {filtered.map((agent) => (
                <AgentCard key={agent.agent_id} agent={agent} currentWallet={publicKey?.toBase58()} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{
          height: 220,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          animation: "pulse 1.5s ease infinite",
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>◈</div>
      <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>No hay agentes todavía</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 24 }}>
        Sé el primero en desplegar un agente en Solana.
      </p>
      <a href="/builder" className="btn btn-primary">Crear agente →</a>
    </div>
  );
}
