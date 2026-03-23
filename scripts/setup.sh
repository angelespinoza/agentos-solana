#!/bin/bash
# ============================================================
# AgentOS — Setup inicial
# ============================================================
# Ejecutar: chmod +x scripts/setup.sh && ./scripts/setup.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ◈ AgentOS — Setup inicial"
echo "=================================="
echo -e "${NC}"

# ── 1. Verificar prerrequisitos ───────────────────────────────────────────

echo -e "${YELLOW}[1/6] Verificando prerrequisitos...${NC}"

MISSING=()
command -v node    &>/dev/null || MISSING+=("node >= 18  → https://nodejs.org")
command -v yarn    &>/dev/null || MISSING+=("yarn        → npm install -g yarn")
command -v solana  &>/dev/null || MISSING+=("solana CLI  → https://docs.solana.com/cli/install-solana-cli-tools")
command -v anchor  &>/dev/null || MISSING+=("anchor CLI  → avm install latest && avm use latest")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}✕ Faltan dependencias:${NC}"
  for m in "${MISSING[@]}"; do echo "  • $m"; done
  exit 1
fi

echo -e "${GREEN}✓ Node $(node --version) | Solana $(solana --version | head -1) | Anchor $(anchor --version)${NC}"

# ── 2. Instalar dependencias npm ──────────────────────────────────────────

echo -e "\n${YELLOW}[2/6] Instalando dependencias npm...${NC}"
yarn install --frozen-lockfile
echo -e "${GREEN}✓ node_modules instalado${NC}"

# ── 3. Configurar .env.local ──────────────────────────────────────────────

echo -e "\n${YELLOW}[3/6] Configurando variables de entorno...${NC}"

if [ -f ".env.local" ]; then
  echo -e "${GREEN}✓ .env.local ya existe, saltando${NC}"
else
  cp .env.example .env.local

  # Generar ENCRYPTION_SECRET aleatorio
  ENCRYPTION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  sed -i "s/string_aleatorio_minimo_64_caracteres_generado_con_openssl_rand/$ENCRYPTION_SECRET/" .env.local

  # Generar ADMIN_SECRET aleatorio
  ADMIN_SECRET=$(openssl rand -hex 16)
  sed -i "s/string_seguro_para_el_endpoint_admin/$ADMIN_SECRET/" .env.local

  echo -e "${GREEN}✓ .env.local creado con secrets aleatorios${NC}"
  echo -e "${YELLOW}  ⚠️  Edita .env.local y completa: SUPABASE_URL, OPENAI_API_KEY, PLATFORM_WALLET${NC}"
fi

# ── 4. Configurar Solana en devnet ────────────────────────────────────────

echo -e "\n${YELLOW}[4/6] Configurando Solana devnet...${NC}"

solana config set --url devnet

# Crear wallet si no existe
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --outfile "$HOME/.config/solana/id.json" --no-bip39-passphrase
  echo -e "${GREEN}✓ Wallet creada: $(solana address)${NC}"
else
  echo -e "${GREEN}✓ Wallet existente: $(solana address)${NC}"
fi

# Solicitar airdrop
BALANCE=$(solana balance --lamports 2>/dev/null | awk '{print $1}' || echo "0")
if [ "$BALANCE" -lt 1000000000 ]; then
  echo "  Solicitando airdrop de 2 SOL en devnet..."
  solana airdrop 2 2>/dev/null || echo "  (airdrop puede fallar si el faucet está ocupado)"
fi

echo -e "${GREEN}✓ Balance: $(solana balance)${NC}"

# ── 5. Build y deploy del Anchor program ─────────────────────────────────

echo -e "\n${YELLOW}[5/6] Build del programa Anchor...${NC}"

anchor build

PROGRAM_ID=$(anchor keys list 2>/dev/null | grep agent_registry | awk '{print $2}')

if [ -n "$PROGRAM_ID" ]; then
  # Actualizar Program ID en los archivos
  sed -i "s/AGNTos1111111111111111111111111111111111111/$PROGRAM_ID/g" \
    programs/agent-registry/src/lib.rs \
    Anchor.toml \
    .env.local 2>/dev/null || true

  anchor build  # rebuild con el ID correcto

  echo -e "${GREEN}✓ Programa compilado: $PROGRAM_ID${NC}"

  echo "  Desplegando en devnet..."
  anchor deploy --provider.cluster devnet && \
    echo -e "${GREEN}✓ Programa desplegado en devnet${NC}" || \
    echo -e "${YELLOW}  (el deploy puede requerir más SOL. Ejecuta: solana airdrop 2)${NC}"
else
  echo -e "${YELLOW}  ⚠️  No se pudo obtener el Program ID. Ejecuta 'anchor build' manualmente.${NC}"
fi

# ── 6. Resumen final ──────────────────────────────────────────────────────

echo -e "\n${GREEN}=================================================="
echo "  ✅ Setup completado"
echo "=================================================="
echo ""
echo "  PRÓXIMOS PASOS:"
echo ""
echo "  1. Completar .env.local:"
echo "     • SUPABASE_URL + SUPABASE_SERVICE_KEY"
echo "     • OPENAI_API_KEY (o ANTHROPIC_API_KEY)"
echo "     • PLATFORM_WALLET (tu wallet de AgentOS)"
echo "     • PLATFORM_KEYPAIR_BS58"
echo ""
echo "  2. Ejecutar schema en Supabase:"
echo "     → Ir a supabase.com → SQL Editor → pegar supabase/schema.sql"
echo ""
echo "  3. Iniciar el proyecto:"
echo "     yarn dev          # frontend en :3000"
echo "     yarn worker:payout  # worker de pagos (terminal separada)"
echo ""
echo "  4. Abrir http://localhost:3000"
echo -e "==================================================${NC}"
