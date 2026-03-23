"use client";

import { useState } from "react";
import { LLMProvider, PROVIDER_MODELS, validateApiKey, maskApiKey } from "../../lib/encryption";
import { calcMinimumPrice } from "../../lib/llm-router";

interface StepLLMConfigProps {
  config: {
    llmProvider:  LLMProvider;
    ownApiKey:    string;       // texto plano — solo en memoria, nunca se loguea
    useOwnKey:    boolean;
    priceUsdc:    number;
  };
  update: (key: keyof import("./page").AgentConfig, value: any) => void;
}

export function StepLLMConfig({ config, update }: StepLLMConfigProps) {
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyError, setKeyError]     = useState("");

  const providerMeta   = PROVIDER_MODELS[config.llmProvider];
  const minPrice       = calcMinimumPrice(config.llmProvider);
  const isBelowMin     = !config.useOwnKey && config.priceUsdc < minPrice;

  const handleKeyChange = (val: string) => {
    update("ownApiKey", val);
    if (val.length > 10) {
      const valid = validateApiKey(val, config.llmProvider);
      setKeyError(valid ? "" : `Formato inválido para ${providerMeta.label}`);
    } else {
      setKeyError("");
    }
  };

  const handleProviderChange = (provider: LLMProvider) => {
    update("llmProvider", provider);
    update("ownApiKey", "");
    setKeyError("");
    // Si usa key de plataforma, ajustar precio mínimo automáticamente
    if (!config.useOwnKey) {
      const newMin = calcMinimumPrice(provider);
      if (config.priceUsdc < newMin) update("priceUsdc", newMin);
    }
  };

  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Modelo de IA</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Elige el proveedor y si usas tu propia API Key o la de AgentOS.
      </p>

      {/* Toggle: propia vs plataforma */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        {[
          {
            value: false,
            label: "⚡ Usar key de AgentOS",
            desc:  "Sin configuración. Precio mínimo aplicado automáticamente.",
            badge: "Más fácil",
            badgeClass: "badge-green",
          },
          {
            value: true,
            label: "🔑 Usar mi propia key",
            desc:  "Control total. Sin restricciones de precio. Tu key, tu costo.",
            badge: "Más control",
            badgeClass: "badge-purple",
          },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => {
              update("useOwnKey", opt.value);
              if (!opt.value) {
                const min = calcMinimumPrice(config.llmProvider);
                if (config.priceUsdc < min) update("priceUsdc", min);
              }
            }}
            style={{
              padding: "18px 16px",
              background: config.useOwnKey === opt.value ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
              border: `1px solid ${config.useOwnKey === opt.value ? "rgba(20,241,149,0.4)" : "var(--border)"}`,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {opt.label}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
              {opt.desc}
            </div>
            <span className={`badge ${opt.badgeClass}`} style={{ fontSize: "0.6rem" }}>
              {opt.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Proveedor */}
      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="form-label">Proveedor LLM</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(Object.entries(PROVIDER_MODELS) as [LLMProvider, typeof PROVIDER_MODELS[LLMProvider]][]).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => handleProviderChange(id)}
              style={{
                padding: "12px 14px",
                background: config.llmProvider === id ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
                border: `1px solid ${config.llmProvider === id ? "rgba(20,241,149,0.3)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: 2 }}>
                  {meta.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  {meta.model}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--sol-green)", textAlign: "right" }}>
                ${(meta.costPer1kTokens * 1000).toFixed(4)}<br />
                <span style={{ color: "var(--text-muted)" }}>/1k tokens</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* API Key propia */}
      {config.useOwnKey && (
        <div className="form-group animate-fade-in" style={{ marginBottom: 20 }}>
          <label className="form-label">Tu API Key de {providerMeta.label}</label>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type={keyVisible ? "text" : "password"}
              placeholder={
                config.llmProvider === "anthropic" ? "sk-ant-api03-..." :
                config.llmProvider === "groq"      ? "gsk_..." :
                "sk-..."
              }
              value={config.ownApiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              style={{
                paddingRight: 44,
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                borderColor: keyError ? "#ff6b6b" : undefined,
              }}
            />
            <button
              onClick={() => setKeyVisible(!keyVisible)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
              }}
            >
              {keyVisible ? "🙈" : "👁"}
            </button>
          </div>

          {keyError && (
            <span style={{ fontSize: "0.75rem", color: "#ff6b6b", fontFamily: "var(--font-mono)" }}>
              ✕ {keyError}
            </span>
          )}
          {!keyError && config.ownApiKey.length > 10 && (
            <span style={{ fontSize: "0.75rem", color: "var(--sol-green)", fontFamily: "var(--font-mono)" }}>
              ✓ Formato válido · Se encriptará con AES-256 antes de guardar
            </span>
          )}

          <div style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "rgba(20,241,149,0.03)",
            border: "1px solid rgba(20,241,149,0.15)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}>
            🔒 Tu key se encripta con AES-256-GCM antes de guardarse. AgentOS nunca la ve en texto plano
            ni la comparte con terceros. Solo se desencripta en memoria para ejecutar tu agente.
          </div>
        </div>
      )}

      {/* Aviso precio mínimo si usa key de plataforma */}
      {!config.useOwnKey && (
        <div className="animate-fade-in" style={{
          padding: "14px 16px",
          background: isBelowMin ? "rgba(255,107,107,0.05)" : "rgba(20,241,149,0.03)",
          border: `1px solid ${isBelowMin ? "rgba(255,107,107,0.3)" : "rgba(20,241,149,0.15)"}`,
          borderRadius: "var(--radius-sm)",
          fontSize: "0.82rem",
          lineHeight: 1.6,
        }}>
          {isBelowMin ? (
            <span style={{ color: "#ff8080" }}>
              ⚠️ Con la key de AgentOS, el precio mínimo para {providerMeta.label} es{" "}
              <strong>${minPrice.toFixed(4)} USDC</strong>. Ajusta el precio en el paso anterior.
            </span>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>
              ✓ AgentOS cubrirá el costo de tokens de {providerMeta.label} (modelo: {providerMeta.model}).
              Tu precio de <strong style={{ color: "var(--sol-green)" }}>${config.priceUsdc} USDC</strong> cubre
              el uso + margen de plataforma.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
