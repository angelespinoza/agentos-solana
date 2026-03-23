"use client";

import { useState } from "react";
import { AGENT_TEMPLATES } from "../../lib/solana/client";
import { Agent } from "../marketplace/page";
import { AgentChatModal } from "./AgentChatModal";

interface AgentCardProps {
  agent: Agent;
  currentWallet?: string;
  showOwnerActions?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

const TONES = ["Profesional", "Casual", "Técnico", "Empático", "Directo"];

export function AgentCard({
  agent,
  currentWallet,
  showOwnerActions = false,
  onPause,
  onResume,
}: AgentCardProps) {
  const [showChat, setShowChat] = useState(false);
  const template = AGENT_TEMPLATES.find((t) => t.id === agent.template) ?? AGENT_TEMPLATES[0];
  const isOwner = currentWallet === agent.owner;

  return (
    <>
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
          overflow: "hidden",
          transition: "all 0.2s",
          cursor: "default",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(20,241,149,0.2)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${template.color}, transparent)`,
        }} />

        {/* Card body */}
        <div style={{ padding: "20px 20px 16px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: `${template.color}15`,
              border: `1px solid ${template.color}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
            }}>
              {template.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {agent.name}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="badge badge-muted" style={{ fontSize: "0.65rem" }}>
                  {template.name}
                </span>
                {agent.access_type === 1 && (
                  <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>
                    🎫 NFT-Gated
                  </span>
                )}
                {isOwner && (
                  <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>
                    Tuyo
                  </span>
                )}
              </div>
            </div>

            {/* Live dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot-live" />
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 16,
          }}>
            <StatBox
              label="Precio"
              value={agent.price_usdc === 0 ? "Gratis" : `$${agent.price_usdc}`}
              accent="var(--sol-green)"
            />
            <StatBox
              label="Usos"
              value={agent.uses_total.toLocaleString()}
            />
            <StatBox
              label="Revenue"
              value={`$${(agent.revenue_total ?? 0).toFixed(2)}`}
              accent="var(--sol-blue)"
            />
          </div>

          {/* Owner address */}
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            marginBottom: 16,
          }}>
            {agent.owner.substring(0, 8)}...{agent.owner.substring(agent.owner.length - 6)}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowChat(true)}
              style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "9px 14px" }}
            >
              ◈ Consultar
            </button>

            <a
              href={`/api/agent/${agent.agent_id}/query`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "9px 12px" }}
              title="Ver endpoint"
            >
              {"</>"}
            </a>

            {showOwnerActions && (
              <button
                className="btn btn-ghost"
                onClick={onPause}
                style={{ fontSize: "0.75rem", padding: "9px 12px", color: "var(--text-muted)" }}
                title="Pausar agente"
              >
                ⏸
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && (
        <AgentChatModal agent={agent} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--bg-elevated)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border)",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6rem",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.85rem",
        fontWeight: 700,
        color: accent ?? "var(--text-primary)",
      }}>{value}</div>
    </div>
  );
}
