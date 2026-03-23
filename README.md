# AgentOS ◈
> No-Code AI Agent Platform on Solana · Powered by x402 · Autonomous via OpenClaw

**La primera plataforma No-Code donde cualquier persona crea, deploya y monetiza agentes de IA en Solana — en menos de 5 minutos, sin escribir código.**

🌐 **Live:** [agentos-ebon.vercel.app](https://agentos-ebon.vercel.app)  
⛓️ **Program ID (Devnet):** `BF3gD81vZR7XMkbnNoWQxwEMRG4ieBA46KNW2o3X3Gdv`  
🐙 **GitHub:** [github.com/angelespinoza/agentos-solana](https://github.com/angelespinoza/agentos-solana)

---

## ¿Qué es AgentOS?

AgentOS es la **App Store de Agentes de IA en Solana**. Donde en lugar de apps, hay agentes que trabajan, cobran y actúan solos.

```
Problema actual:
  Crear un agente de IA que actúe solo, cobre automáticamente y tenga
  identidad propia requiere semanas de desarrollo y cientos de USD/mes.

Solución:
  AgentOS → Builder No-Code → Deploy on-chain → x402 cobra → OpenClaw actúa
```

### Los 4 pilares

| # | Pilar | Descripción |
|---|-------|-------------|
| 01 | **CREAR** | Builder No-Code de 7 pasos. Sin escribir código. |
| 02 | **DEPLOYAR** | On-chain en Solana. Identidad permanente en la blockchain. |
| 03 | **MONETIZAR** | x402 Protocol. Cobra en USDC automáticamente por cada consulta. |
| 04 | **AUTONOMÍA** | OpenClaw Worker. El agente actúa solo 24/7 en Twitter y Telegram. |

---

## Demo

🎬 **Flujo completo en 3 minutos:**

```
1. Conecta tu wallet (Phantom / Solflare)
2. Builder → 7 pasos:
     Template → Identidad → Conocimiento → Precio → Modelo IA → Autonomía → Deploy
3. Agente registrado on-chain en Solana con PDA único
4. Endpoint x402 público: POST /api/agent/{id}/query
5. Cualquier persona lo consulta y paga en USDC automáticamente
6. Modo autónomo: el agente publica en Twitter/Telegram sin intervención humana
```

### Agentes en vivo (Devnet)

Los agentes deployados aparecen en el [Marketplace](https://agentos-ebon.vercel.app/marketplace) con sus endpoints públicos y stats de uso en tiempo real.

---

## Autonomía con OpenClaw

El diferenciador clave de AgentOS es que los agentes **no solo responden** — actúan solos.

```
AgentOS Builder (configuras trigger + acción)
    ↓
Solana On-Chain (identidad del agente permanente)
    ↓
OpenClaw Worker (loop 24/7 en VPS, cada X minutos)
    ↓
Twitter / Telegram (publica automáticamente)
```

### Triggers disponibles
- ⏱ **Intervalo** — cada X minutos
- 🕐 **Schedule** — a una hora específica del día
- 📈 **Price Alert** — cuando un token DeFi sube/baja X%

### Acciones disponibles
- 🐦 **Twitter** — tuitea desde la cuenta del proyecto
- ✈️ **Telegram** — envía mensaje al Chat ID del usuario

### Casos de uso demostrados
- **SOL Alert Bot** — monitorea precio de Solana vía CoinGecko y tuitea alertas cada 5 min
- **DeFi Newsletter** — genera y envía análisis de mercado a Telegram en schedule diario
- **Agente de Contenido** — publica tweets informativos sobre Web3 en horarios programados

---

## Flujo de pagos x402

```
Usuario → POST /api/agent/{id}/query
        ← 402 Payment Required
          { amount: X USDC, payTo: PLATFORM_WALLET }
        → X-PAYMENT: <signed_tx_base64>
        ← Facilitador Coinbase verifica on-chain
        ← 200 OK + respuesta del agente (streaming SSE)

Split automático:
  Total pagado → PLATFORM_WALLET (escrow)
    ├── 5%  → AgentOS (plataforma)
    └── 95% → Owner del agente
```

**¿Por qué x402 + Solana?**
- `$0.00025` por transacción — micropagos viables
- `400ms` de finalidad — respuesta instantánea
- Sin cuentas, sin suscripciones, sin intermediarios
- Facilitador oficial de Coinbase incluido

---

## Stack

| Capa | Tecnología |
|------|-----------|
| On-chain | Anchor (Rust) · Solana Devnet |
| Pagos | x402 Protocol · @x402/svm · Coinbase Facilitator |
| Frontend | Next.js 14 · TypeScript · Vercel |
| Wallet | @solana/wallet-adapter (Phantom, Solflare) |
| IA / LLM | OpenAI GPT-4o-mini · Anthropic Claude · Groq · Together AI |
| DB | Supabase (Postgres + RLS) |
| Autonomía | OpenClaw Worker · Twitter API v2 · Telegram Bot API |
| Seguridad | AES-256-GCM para API Keys |
| Infra | Vercel (frontend) · Hostinger VPS (worker) |

---

## Estructura del proyecto

```
agentOS/
├── programs/
│   └── agent-registry/        # Anchor Program (Rust)
│       └── src/lib.rs
├── app/
│   ├── page.tsx               # Landing
│   ├── marketplace/           # Explorar agentes activos
│   ├── builder/               # No-code builder (7 pasos)
│   │   ├── page.tsx
│   │   ├── helpers.ts         # buildSystemPrompt
│   │   ├── DeployModal.tsx
│   │   ├── StepLLMConfig.tsx
│   │   └── StepAutonomy.tsx   # Configuración de autonomía
│   ├── agent/[agentId]/       # Página pública del agente
│   ├── dashboard/             # Panel del owner
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── AgentCard.tsx
│   │   ├── AgentChatModal.tsx
│   │   └── WalletButton.tsx
│   └── api/
│       ├── agent/[id]/query/  # Endpoint x402 del agente
│       ├── agents/            # CRUD
│       ├── agents/[id]/status # Pause/resume
│       ├── x402/pay/          # Construye tx de pago
│       └── admin/stats/       # Revenue de plataforma
├── lib/
│   ├── network.ts             # Config devnet/mainnet
│   ├── encryption.ts          # AES-256-GCM
│   ├── llm-router.ts          # Multi-proveedor LLM
│   ├── x402-middleware.ts     # Payment gate + NFT verification
│   └── solana/client.ts
├── workers/
│   └── payout-worker.ts       # Distribuye pagos al owner
└── supabase/
    └── schema.sql
```

---

## Setup rápido

### Prerrequisitos

```bash
# Rust + Anchor
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest && avm use latest

# Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Node >= 18
node --version
```

### Variables de entorno

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=BF3gD81vZR7XMkbnNoWQxwEMRG4ieBA46KNW2o3X3Gdv
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=sk-...
PLATFORM_WALLET=your_wallet_address
PLATFORM_KEYPAIR_BS58=your_keypair
ENCRYPTION_SECRET=min_32_chars_secret
ADMIN_SECRET=your_admin_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Base de datos

```bash
# Ejecutar en el SQL Editor de Supabase:
supabase/schema.sql
```

### Anchor Program

```bash
solana config set --url devnet
solana airdrop 2
anchor build
anchor deploy --provider.cluster devnet
```

### Frontend

```bash
yarn install
yarn dev
# → http://localhost:3000
```

### Worker autónomo (OpenClaw VPS)

```bash
cd openclaw-worker
npm install @supabase/supabase-js twitter-api-v2
node worker.js
# → Ejecuta agentes autónomos cada 60 segundos
```

---

## Modelo de API Keys

| Modo | Quién paga los tokens | Precio mínimo |
|------|-----------------------|---------------|
| Key propia | El owner del agente | Libre |
| Key AgentOS | AgentOS (markup 3x) | Calculado por proveedor |

Proveedores: **OpenAI · Anthropic · Groq · Together AI**

---

## Anchor Program — Instrucciones

| Instrucción | Signer | Descripción |
|-------------|--------|-------------|
| `create_agent` | Owner | Registra el agente on-chain |
| `set_status` | Owner | Pausa / activa |
| `update_price` | Owner | Cambia precio x402 |
| `update_config` | Owner | Nuevo system prompt (hash) |
| `record_payment` | Worker | Registra pago recibido |
| `close_agent` | Owner | Cierra y recupera rent |

**PDA del agente:**
```
seeds = ["agent", owner.publicKey, agentId]
```

---

## Roadmap post-hackathon

- [ ] RAG con knowledge base (PDFs, URLs, Notion)
- [ ] Agent-to-agent payments (agentes que se pagan entre sí)
- [ ] Marketplace de templates de terceros
- [ ] Mobile app
- [ ] Deploy a mainnet

---

## Construido en

**Solana Hackathon — Marzo 2026**

Stack: Anchor · Next.js · x402 · OpenClaw · Supabase · OpenAI

---

*AgentOS — Built on Solana · Powered by x402 · Autonomous via OpenClaw*
