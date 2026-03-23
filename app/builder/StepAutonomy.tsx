"use client";

import { useState } from "react";

export interface AutonomyConfig {
  enabled: boolean;
  triggerType: "interval" | "price_alert" | "schedule";
  intervalMinutes: number;
  scheduleTime: string;
  priceToken: string;
  priceChangePercent: number;
  actionType: "twitter" | "telegram";
  twitterHandle: string;
  telegramChatId: string;
  prompt: string;
}

export const DEFAULT_AUTONOMY: AutonomyConfig = {
  enabled: false,
  triggerType: "interval",
  intervalMinutes: 60,
  scheduleTime: "09:00",
  priceToken: "SOL",
  priceChangePercent: 5,
  actionType: "twitter",
  twitterHandle: "",
  telegramChatId: "",
  prompt: "Genera un mensaje corto y relevante basado en tu conocimiento.",
};

const TRIGGER_LABELS: Record<string, string> = {
  interval:     "⏱ Cada X minutos",
  price_alert:  "📈 Alerta de precio",
  schedule:     "🕐 Schedule diario",
};

const ACTION_LABELS: Record<string, string> = {
  twitter:  "🐦 Publicar en Twitter",
  telegram: "✈️ Enviar a Telegram",
};

export function StepAutonomy({ config, update }: { config: AutonomyConfig; update: Function }) {
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Autonomía del Agente</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Activa tu agente para que actúe solo, sin que nadie lo llame. Powered by OpenClaw.
      </p>

      {/* Toggle */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 24px",
        background: config.enabled ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
        border: `1px solid ${config.enabled ? "rgba(20,241,149,0.3)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 24,
        cursor: "pointer",
      }} onClick={() => update("enabled", !config.enabled)}>
        <div style={{
          width: 48, height: 26,
          background: config.enabled ? "var(--sol-green)" : "var(--border)",
          borderRadius: 13,
          position: "relative",
          transition: "background 0.2s",
        }}>
          <div style={{
            position: "absolute",
            top: 3, left: config.enabled ? 25 : 3,
            width: 20, height: 20,
            background: "white",
            borderRadius: "50%",
            transition: "left 0.2s",
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>
            {config.enabled ? "✅ Modo autónomo activado" : "Activar modo autónomo"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Tu agente actuará solo vía OpenClaw 24/7
          </div>
        </div>
      </div>

      {config.enabled && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Trigger */}
          <div className="form-group">
            <label className="form-label">¿Cuándo actúa el agente?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update("triggerType", val)}
                  style={{
                    padding: "12px 8px",
                    background: config.triggerType === val ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
                    border: `1px solid ${config.triggerType === val ? "rgba(20,241,149,0.4)" : "var(--border)"}`,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    textAlign: "center",
                    color: "var(--text-primary)",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Trigger config */}
          {config.triggerType === "interval" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Intervalo (minutos)</label>
              <input
                type="number"
                className="form-input"
                value={config.intervalMinutes}
                onChange={(e) => update("intervalMinutes", parseInt(e.target.value) || 60)}
                min={5}
                max={1440}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Mínimo 5 minutos · Máximo 1440 (24h)
              </span>
            </div>
          )}

          {config.triggerType === "schedule" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Hora del día (UTC)</label>
              <input
                type="time"
                className="form-input"
                value={config.scheduleTime}
                onChange={(e) => update("scheduleTime", e.target.value)}
              />
            </div>
          )}

          {config.triggerType === "price_alert" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Token a monitorear</label>
                <select className="form-select" value={config.priceToken} onChange={(e) => update("priceToken", e.target.value)}>
                  {["SOL", "BTC", "ETH", "BONK", "JUP", "WIF"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cambio de precio que activa la alerta (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.priceChangePercent}
                  onChange={(e) => update("priceChangePercent", parseFloat(e.target.value) || 5)}
                  min={1}
                  max={50}
                />
              </div>
            </div>
          )}

          <div className="divider" />

          {/* Action */}
          <div className="form-group">
            <label className="form-label">¿Qué hace el agente?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update("actionType", val)}
                  style={{
                    padding: "14px",
                    background: config.actionType === val ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
                    border: `1px solid ${config.actionType === val ? "rgba(20,241,149,0.4)" : "var(--border)"}`,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    color: "var(--text-primary)",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {config.actionType === "twitter" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Twitter handle (sin @)</label>
              <input
                className="form-input"
                placeholder="ej: SolanaNewsBot"
                value={config.twitterHandle}
                onChange={(e) => update("twitterHandle", e.target.value)}
              />
            </div>
          )}

          {config.actionType === "telegram" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Telegram Chat ID</label>
              <input
                className="form-input"
                placeholder="ej: -1001234567890"
                value={config.telegramChatId}
                onChange={(e) => update("telegramChatId", e.target.value)}
              />
            </div>
          )}

          {/* Prompt autónomo */}
          <div className="form-group">
            <label className="form-label">Instrucción para cada ejecución autónoma</label>
            <textarea
              className="form-textarea"
              placeholder="ej: Analiza el mercado de Solana y genera un tweet informativo de máximo 280 caracteres."
              value={config.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              style={{ minHeight: 90 }}
            />
          </div>

          {/* Info box */}
          <div style={{
            padding: 16,
            background: "rgba(20,241,149,0.03)",
            border: "1px solid rgba(20,241,149,0.15)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}>
            <div style={{ color: "var(--sol-green)", fontWeight: 600, marginBottom: 8 }}>
              ⚡ Powered by OpenClaw
            </div>
            Tu agente correrá en los servidores de OpenClaw 24/7. Cada ejecución autónoma
            consume una consulta al agente (cobra vía x402 automáticamente).
          </div>
        </div>
      )}
    </div>
  );
}
