# AgentOS ◈
> No-Code AI Agent Platform on Solana · Powered by x402

Crea, despliega y monetiza agentes de IA sin escribir una línea de código. Cada agente vive on-chain en Solana y cobra automáticamente vía x402.

---

## Demo flow

```
1. Conectar Phantom / Backpack / Solflare
2. Builder (6 pasos) → Template · Identidad · Conocimiento · Precio · LLM · Deploy
3. Agente queda registrado on-chain con tu wallet como owner
4. Aparece en el Marketplace con su URL pública: /agent/{id}
5. Cualquier persona lo consulta y paga automáticamente via x402
6. Dashboard → stats de uso, revenue, pause/resume
```

---

## Stack

| Capa | Tecnología |
|---|---|
| On-chain | Anchor (Rust) · Solana |
| Frontend | Next.js 14 · TypeScript |
| Wallet | @solana/wallet-adapter |
| Pagos | x402 protocol · @x402/svm |
| LLM | OpenAI · Anthropic · Groq · Together |
| DB | Supabase (Postgres) |
| NFT | Metaplex SDK · Helius |
| Workers | Node.js · tsx |
| Deploy | Vercel (frontend) · Railway (workers) |

---

## Estructura

```
agentOS/
├── programs/
│   └── agent-registry/        # Anchor Program (Rust)
│       └── src/lib.rs         # PDA, instrucciones, eventos
├── app/
│   ├── page.tsx               # Landing
│   ├── marketplace/           # Explorar agentes activos
│   ├── builder/               # No-code builder (6 pasos)
│   │   ├── page.tsx
│   │   ├── DeployModal.tsx
│   │   └── StepLLMConfig.tsx
│   ├── agent/[agentId]/       # Página pública del agente
│   ├── dashboard/             # Panel del owner
│   ├── components/
│   │   ├── Navbar.tsx         # Con hamburger menu mobile
│   │   ├── AgentCard.tsx
│   │   └── AgentChatModal.tsx # Chat con flujo x402
│   ├── api/
│   │   ├── agent/[id]/query/  # Endpoint público del agente (POST con x402)
│   │   ├── agents/            # CRUD de agentes
│   │   ├── agents/[id]/status # Pause/resume (solo owner)
│   │   ├── x402/pay/          # Construye tx de pago
│   │   └── admin/stats/       # Revenue de plataforma
│   └── providers/
│       └── WalletProvider.tsx
├── lib/
│   ├── network.ts             # Config centralizada devnet/mainnet
│   ├── encryption.ts          # AES-256-GCM para API Keys
│   ├── llm-router.ts          # Router multi-proveedor LLM
│   └── solana/client.ts       # Client TypeScript del programa
├── workers/
│   ├── x402-middleware.ts     # Payment gate + NFT verification
│   └── payout-worker.ts       # Distribuye pagos al owner cada 60s
├── supabase/
│   └── schema.sql             # Tablas, funciones, RLS policies
├── scripts/
│   └── deploy-mainnet.sh      # Script seguro de deploy a mainnet
└── tests/
    └── agent-registry.ts      # 8 tests del Anchor program
```

---

## Setup rápido

### 1. Prerrequisitos

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest && avm use latest

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Node
node --version  # >= 18
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Llenar: SUPABASE_URL, OPENAI_API_KEY, PLATFORM_WALLET, ENCRYPTION_SECRET
```

### 3. Base de datos

```bash
# En el SQL Editor de tu proyecto Supabase:
# Ejecutar supabase/schema.sql
```

### 4. Anchor Program (devnet)

```bash
# Configurar wallet de deploy
solana config set --url devnet
solana airdrop 2  # SOL de prueba en devnet

# Build + deploy
anchor build
anchor deploy --provider.cluster devnet

# Copiar el Program ID al .env
# NEXT_PUBLIC_PROGRAM_ID=<program_id_del_output>
```

### 5. Frontend

```bash
yarn install
yarn dev
# → http://localhost:3000
```

### 6. Worker de pagos (terminal separada)

```bash
yarn worker:payout
# → Procesa pagos pendientes al owner cada 60s
```

---

## Anchor Program

### PDA del agente
```
seeds = ["agent", owner.publicKey, agentId]
```

### Instrucciones

| Instrucción | Signer | Descripción |
|---|---|---|
| `create_agent` | Owner | Registra el agente on-chain |
| `set_status` | Owner | Pausa / activa |
| `update_price` | Owner | Cambia precio x402 |
| `update_config` | Owner | Nuevo system prompt (hash) |
| `record_payment` | Worker | Registra pago recibido |
| `close_agent` | Owner | Cierra y recupera rent |

---

## Flujo de pagos x402

```
Usuario → POST /api/agent/{id}/query
        ← 402 Payment Required
          { amount: X USDC, payTo: PLATFORM_WALLET }
        → X-PAYMENT: <signed_tx_base64>
        ← Facilitador Coinbase verifica on-chain
        ← 200 OK + respuesta del agente (streaming SSE)

Split automático cada 60s (payout-worker):
  Total pagado → PLATFORM_WALLET (escrow)
    ├── 5% → AgentOS (plataforma)
    └── 95% → Owner del agente
```

---

## Modelo de API Keys (híbrido)

| Modo | Quién paga los tokens | Precio mínimo | Cómo |
|---|---|---|---|
| Key propia | El owner del agente | Libre | Se encripta AES-256 en Supabase |
| Key AgentOS | AgentOS (con markup 3x) | Calculado por proveedor | NULL en DB |

Proveedores soportados: OpenAI · Anthropic · Groq · Together AI

---

## Tipos de acceso

| Tipo | Verificación |
|---|---|
| Público | Cualquiera con wallet puede consultar |
| NFT-Gated | Verificación on-chain de ownership via Metaplex |

---

## Deploy a mainnet

```bash
chmod +x scripts/deploy-mainnet.sh
./scripts/deploy-mainnet.sh
# El script guía paso a paso con validaciones de seguridad
# Costo estimado: ~2-3 SOL para el rent del programa
```

Cambiar a mainnet en `.env`:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## Admin API

```bash
# Stats de la plataforma
curl /api/admin/stats \
  -H "X-Admin-Secret: TU_ADMIN_SECRET"

# Respuesta:
{
  "platform": {
    "totalAgents": 42,
    "totalVolume": "127.3400",
    "platformRevenue": "6.3670",   # 5% de todo
    "ownerPayouts": "120.9730",
    "feeBps": 500
  },
  "topAgents": [...],
  "revenueByDay": [...]
}
```

---

## Tests

```bash
# Tests del Anchor program (8 casos)
anchor test

# Casos cubiertos:
# ✅ Crear agente
# ✅ Actualizar precio
# ✅ Actualizar config hash
# ✅ Registrar pago
# ✅ Pausar agente
# ✅ Reactivar agente
# ❌ Non-owner no puede pausar
# ❌ No acepta nombres vacíos
```

---

## Roadmap post-hackathon

- [ ] RAG con knowledge base (PDFs, URLs, Notion)
- [ ] Templates adicionales (DeFi, Contenido)
- [ ] Agent-to-agent payments (agentes que se pagan entre sí)
- [ ] Marketplace de templates de terceros
- [ ] Dashboard de analytics avanzado
- [ ] Mobile app (React Native)
- [ ] Deploy a mainnet

---

## Equipo

Construido en el hackathon de Solana · Marzo 2026

**AgentOS** — [agentos.xyz](https://agentos.xyz) · hola@agentos.xyz
