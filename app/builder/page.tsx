"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "../components/Navbar";
import { AGENT_TEMPLATES } from "../../lib/solana/client";
import { DeployModal } from "./DeployModal";
import { StepLLMConfig } from "./StepLLMConfig";
import { StepAutonomy, AutonomyConfig, DEFAULT_AUTONOMY } from "./StepAutonomy";
import type { LLMProvider } from "../../lib/encryption";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  // Template
  template: 0 | 1 | 2;
  // Identity
  name: string;
  toneIndex: number;
  language: string;
  // Knowledge
  whoIs: string;
  whatKnows: string;
  whatNotDo: string;
  // Pricing & Access
  priceUsdc: number;
  accessType: 0 | 1;
  nftCollection: string;
  // LLM
  llmProvider: LLMProvider;
  useOwnKey: boolean;
  ownApiKey: string;
}

const TONES     = ["Profesional", "Casual", "Técnico", "Empático", "Directo"];
const LANGUAGES = ["Español", "English", "Português", "Español + English"];

const DEFAULT_CONFIG: AgentConfig = {
  template:      0,
  name:          "",
  toneIndex:     0,
  language:      "Español",
  whoIs:         "",
  whatKnows:     "",
  whatNotDo:     "",
  priceUsdc:     0.01,
  accessType:    0,
  nftCollection: "",
  llmProvider:   "openai",
  useOwnKey:     false,
  ownApiKey:     "",
};

// 6 pasos en total
const STEPS = ["Template", "Identidad", "Conocimiento", "Precio & Acceso", "Modelo IA", "Autonomía", "Deploy"];

// ── Validación por paso ────────────────────────────────────────────────────

function canAdvance(step: number, config: AgentConfig): boolean {
  if (step === 0) return true;
  if (step === 1) return config.name.trim().length >= 3;
  if (step === 2) return config.whoIs.trim().length >= 20;
  if (step === 3) return config.priceUsdc >= 0;
  if (step === 4) {
    if (config.useOwnKey) return config.ownApiKey.trim().length > 10;
    return true;
  }
  if (step === 5) return true;
  return false;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function BuilderPage() {
  const { connected, publicKey } = useWallet();
  const [step, setStep]           = useState(0);
  const [config, setConfig]       = useState<AgentConfig>(DEFAULT_CONFIG);
  const [showDeploy, setShowDeploy] = useState(false);
  const [autonomy, setAutonomy] = useState<AutonomyConfig>(DEFAULT_AUTONOMY);
  const updateAutonomy = (key: keyof AutonomyConfig, value: any) => setAutonomy(prev => ({ ...prev, [key]: value }));

  const update = (key: keyof AgentConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingBottom: 80 }}>
        <div className="container" style={{ paddingTop: 48 }}>

          {/* Header */}
          <div className="stagger" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="badge badge-green"><span className="dot-live" />Builder</span>
              <span className="badge badge-purple">Devnet</span>
            </div>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
              Crea tu <span style={{ color: "var(--sol-green)" }}>Agente</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 12, maxWidth: 480 }}>
              Sin código. Tu agente vive en Solana y cobra automáticamente vía x402.
            </p>
          </div>

          {/* Layout */}
          <div className="builder-layout" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, alignItems: "start" }}>

            {/* Sidebar */}
            <StepSidebar current={step} config={config} />

            {/* Form panel */}
            <div className="card card-glow animate-fade-in" style={{ padding: 32 }}>

              {step === 0 && <StepTemplate config={config} update={update} />}
              {step === 1 && <StepIdentity config={config} update={update} />}
              {step === 2 && <StepKnowledge config={config} update={update} />}
              {step === 3 && <StepPricing config={config} update={update} />}
              {step === 4 && (
                <StepLLMConfig
                  config={{
                    llmProvider: config.llmProvider,
                    ownApiKey:   config.ownApiKey,
                    useOwnKey:   config.useOwnKey,
                    priceUsdc:   config.priceUsdc,
                  }}
                  update={update}
                />
              )}
              {step === 5 && <StepAutonomy config={autonomy} update={updateAutonomy} />}
              {step === 6 && <StepPreview config={config} />}

              {/* Navigation */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid var(--border)",
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0}
                >
                  ← Atrás
                </button>

                {step < 6 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canAdvance(step, config)}
                  >
                    Siguiente →
                  </button>
                ) : connected ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowDeploy(true)}
                    style={{ fontSize: "0.9rem", padding: "12px 28px" }}
                  >
                    ⚡ Deploy en Solana
                  </button>
                ) : (
                  <WalletMultiButton />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {showDeploy && (
        <DeployModal config={config} autonomy={autonomy} onClose={() => setShowDeploy(false)} />
      )}
    </>
  );
}

// ── Step Sidebar ───────────────────────────────────────────────────────────

function StepSidebar({ current, config }: { current: number; config: AgentConfig }) {
  return (
    <div className="step-sidebar" style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 80 }}>
      {STEPS.map((label, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: i === current ? "rgba(20,241,149,0.05)" : "transparent",
            border: i === current ? "1px solid rgba(20,241,149,0.2)" : "1px solid transparent",
          }}
        >
          <div className={`step-number ${i < current ? "done" : i === current ? "active" : ""}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span style={{
            fontSize: "0.85rem",
            fontFamily: "var(--font-mono)",
            color: i === current ? "var(--sol-green)" : i < current ? "var(--text-secondary)" : "var(--text-muted)",
          }}>
            {label}
          </span>
        </div>
      ))}

      {/* LLM badge */}
      {current >= 4 && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          fontSize: "0.7rem",
          fontFamily: "var(--font-mono)",
        }}>
          <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Modelo</div>
          <div style={{ color: "var(--sol-green)" }}>{config.llmProvider}</div>
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>
            {config.useOwnKey ? "🔑 Key propia" : "⚡ Key AgentOS"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 0: Template ───────────────────────────────────────────────────────

function StepTemplate({ config, update }: { config: AgentConfig; update: Function }) {
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Elige un template</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Cada template define la capacidad base de tu agente.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {AGENT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => update("template", t.id)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "20px 24px",
              background: config.template === t.id ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
              border: `1px solid ${config.template === t.id ? "rgba(20,241,149,0.4)" : "var(--border)"}`,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "2rem", lineHeight: 1 }}>{t.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                {t.name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {t.description}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <span className="badge badge-green">desde ${t.defaultPrice} USDC</span>
                {config.template === t.id && <span className="badge badge-purple">✓ Seleccionado</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 1: Identity ───────────────────────────────────────────────────────

function StepIdentity({ config, update }: { config: AgentConfig; update: Function }) {
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Identidad del Agente</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Cómo se llama, cómo habla y en qué idioma.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="form-group">
          <label className="form-label">Nombre del agente *</label>
          <input
            className="form-input"
            placeholder="ej: SolanaGPT, AsistenteJurídico, DeFiBot..."
            value={config.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={50}
          />
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {config.name.length}/50 caracteres
          </span>
        </div>
        <div className="form-group">
          <label className="form-label">Tono de comunicación</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TONES.map((tone, i) => (
              <button
                key={i}
                onClick={() => update("toneIndex", i)}
                className={`btn ${config.toneIndex === i ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "6px 14px" }}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Idioma</label>
          <select
            className="form-select"
            value={config.language}
            onChange={(e) => update("language", e.target.value)}
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Knowledge ──────────────────────────────────────────────────────

function StepKnowledge({ config, update }: { config: AgentConfig; update: Function }) {
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Conocimiento del Agente</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Define qué sabe tu agente. Esto construye su system prompt automáticamente.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="form-group">
          <label className="form-label">¿Quién es tu agente? *</label>
          <textarea
            className="form-textarea"
            placeholder="ej: Soy un asistente especializado en leyes laborales peruanas..."
            value={config.whoIs}
            onChange={(e) => update("whoIs", e.target.value)}
            style={{ minHeight: 90 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">¿Qué sabe específicamente?</label>
          <textarea
            className="form-textarea"
            placeholder="ej: Conozco el régimen MYPE, la Ley 30709, beneficios sociales..."
            value={config.whatKnows}
            onChange={(e) => update("whatKnows", e.target.value)}
            style={{ minHeight: 90 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">¿Qué NO debe hacer?</label>
          <textarea
            className="form-textarea"
            placeholder="ej: No dar consejos médicos. No hablar de competidores..."
            value={config.whatNotDo}
            onChange={(e) => update("whatNotDo", e.target.value)}
            style={{ minHeight: 70 }}
          />
        </div>
        {config.whoIs && (
          <div style={{
            padding: 16,
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(20,241,149,0.2)",
          }}>
            <div className="form-label" style={{ marginBottom: 8, color: "var(--sol-green)" }}>
              ◈ Preview del System Prompt
            </div>
            <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {buildSystemPrompt(config)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Pricing & Access ───────────────────────────────────────────────

function StepPricing({ config, update }: { config: AgentConfig; update: Function }) {
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Precio & Acceso</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Cuánto cobra tu agente y quién puede usarlo.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="form-group">
          <label className="form-label">Precio por uso (USDC via x402)</label>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              className="form-input"
              value={config.priceUsdc}
              onChange={(e) => update("priceUsdc", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
              style={{ paddingLeft: 40 }}
            />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", color: "var(--sol-green)", fontSize: "0.85rem" }}>$</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[0, 0.01, 0.05, 0.1, 0.5].map((p) => (
              <button
                key={p}
                onClick={() => update("priceUsdc", p)}
                className={`btn ${config.priceUsdc === p ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.7rem", padding: "4px 10px" }}
              >
                {p === 0 ? "Gratis" : `$${p}`}
              </button>
            ))}
          </div>
        </div>
        <div className="divider" />
        <div className="form-group">
          <label className="form-label">Tipo de acceso</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { value: 0, label: "🌐 Público",    desc: "Cualquiera puede usar tu agente" },
              { value: 1, label: "🎫 NFT-Gated",  desc: "Solo holders de un NFT específico" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("accessType", opt.value)}
                style={{
                  padding: "16px",
                  background: config.accessType === opt.value ? "rgba(20,241,149,0.05)" : "var(--bg-elevated)",
                  border: `1px solid ${config.accessType === opt.value ? "rgba(20,241,149,0.4)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {config.accessType === 1 && (
          <div className="form-group animate-fade-in">
            <label className="form-label">Address de la colección NFT</label>
            <input
              className="form-input"
              placeholder="ej: DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4"
              value={config.nftCollection}
              onChange={(e) => update("nftCollection", e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Preview ────────────────────────────────────────────────────────

function StepPreview({ config }: { config: AgentConfig }) {
  const template = AGENT_TEMPLATES.find((t) => t.id === config.template)!;
  return (
    <div className="stagger">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Listo para desplegar</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.9rem" }}>
        Revisa la configuración antes del deploy.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: 24, background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(20,241,149,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: "2.5rem" }}>{template.icon}</span>
            <div>
              <h3 style={{ fontSize: "1.3rem", marginBottom: 4 }}>{config.name || "Sin nombre"}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge badge-green">{template.name}</span>
                <span className="badge badge-blue">{TONES[config.toneIndex]}</span>
                <span className="badge badge-muted">{config.language}</span>
                <span className="badge badge-purple">{config.llmProvider}</span>
                <span className="badge badge-muted">{config.useOwnKey ? "🔑 Key propia" : "⚡ Key AgentOS"}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { label: "Precio x402",   value: config.priceUsdc === 0 ? "Gratis" : `$${config.priceUsdc} USDC`, accent: "var(--sol-green)" },
              { label: "Acceso",        value: config.accessType === 0 ? "🌐 Público" : "🎫 NFT-Gated", accent: undefined },
              { label: "Red",           value: "Solana Devnet", accent: "var(--sol-purple)" },
            ].map((s) => (
              <div key={s.label} style={{ padding: 12, background: "var(--bg-card)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div className="form-label" style={{ marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: s.accent ?? "var(--text-primary)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <div className="form-label" style={{ marginBottom: 8 }}>System Prompt</div>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {buildSystemPrompt(config)}
          </pre>
        </div>
        <div style={{ padding: 16, background: "rgba(20,241,149,0.03)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(20,241,149,0.15)" }}>
          <div className="form-label" style={{ marginBottom: 12, color: "var(--sol-green)" }}>¿Qué pasará al hacer Deploy?</div>
          {[
            "Se firmará una transacción con tu wallet",
            "Se creará un PDA en Solana con la identidad de tu agente",
            config.useOwnKey ? "Tu API Key se encriptará con AES-256 y se guardará de forma segura" : "AgentOS usará su key de LLM con un markup incluido en el precio",
            "Tu agente estará disponible en su endpoint público",
            "Comenzará a recibir pagos automáticamente vía x402",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--sol-green)", fontFamily: "var(--font-mono)" }}>→</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSystemPrompt(config: Partial<AgentConfig>): string {
  const tone = TONES[config.toneIndex ?? 0];
  const lang = config.language ?? "Español";
  return `Eres ${config.name ?? "un agente de IA"}.

IDENTIDAD:
${config.whoIs ?? "(sin definir)"}

CONOCIMIENTO ESPECÍFICO:
${config.whatKnows ?? "(sin definir)"}

RESTRICCIONES:
${config.whatNotDo ?? "Ninguna restricción adicional."}

COMPORTAMIENTO:
- Tono: ${tone}
- Idioma: ${lang}
- Sé conciso y directo. Si no sabes algo, dilo honestamente.
- Nunca inventes información que no tengas.`;
}
