#!/bin/bash
# ============================================================
# AgentOS — Deploy a Solana Mainnet
# ============================================================
# Ejecutar: chmod +x scripts/deploy-mainnet.sh && ./scripts/deploy-mainnet.sh

set -e  # salir si cualquier comando falla

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ◈ AgentOS — Deploy a Mainnet"
echo "=================================================="
echo -e "${NC}"

# ── Paso 1: Verificaciones previas ────────────────────────────────────────

echo -e "${YELLOW}[1/7] Verificando prerrequisitos...${NC}"

# Verificar Anchor CLI
if ! command -v anchor &> /dev/null; then
  echo -e "${RED}✕ Anchor CLI no instalado. Instalar con: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force${NC}"
  exit 1
fi

# Verificar Solana CLI
if ! command -v solana &> /dev/null; then
  echo -e "${RED}✕ Solana CLI no instalado. Ver: https://docs.solana.com/cli/install-solana-cli-tools${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Anchor $(anchor --version) | Solana $(solana --version)${NC}"

# ── Paso 2: Configurar RPC de mainnet ────────────────────────────────────

echo -e "\n${YELLOW}[2/7] Configurando RPC de mainnet...${NC}"

# Usar Helius (más estable que el RPC público para deploys grandes)
RPC_URL="${MAINNET_RPC_URL:-https://api.mainnet-beta.solana.com}"
solana config set --url "$RPC_URL"

echo -e "${GREEN}✓ RPC: $RPC_URL${NC}"

# ── Paso 3: Verificar keypair de deploy ───────────────────────────────────

echo -e "\n${YELLOW}[3/7] Verificando keypair de deploy...${NC}"

DEPLOY_KEYPAIR="${DEPLOY_KEYPAIR_PATH:-$HOME/.config/solana/deploy-keypair.json}"

if [ ! -f "$DEPLOY_KEYPAIR" ]; then
  echo -e "${RED}✕ Keypair de deploy no encontrado en: $DEPLOY_KEYPAIR${NC}"
  echo "  Genera uno nuevo con: solana-keygen new --outfile $DEPLOY_KEYPAIR"
  echo "  IMPORTANTE: Este keypair necesita SOL real para el deploy (~3-5 SOL para el rent)"
  exit 1
fi

solana config set --keypair "$DEPLOY_KEYPAIR"
DEPLOY_PUBKEY=$(solana address)
BALANCE=$(solana balance --lamports | awk '{print $1}')
BALANCE_SOL=$(echo "scale=4; $BALANCE / 1000000000" | bc)

echo -e "${GREEN}✓ Deploy wallet: $DEPLOY_PUBKEY${NC}"
echo -e "${GREEN}✓ Balance: $BALANCE_SOL SOL${NC}"

# Verificar balance mínimo (necesitas ~3 SOL para el rent del programa)
MIN_BALANCE=3000000000  # 3 SOL en lamports
if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
  echo -e "${RED}✕ Balance insuficiente. Necesitas al menos 3 SOL para el deploy.${NC}"
  echo "  Balance actual: $BALANCE_SOL SOL"
  exit 1
fi

# ── Paso 4: Build del programa ────────────────────────────────────────────

echo -e "\n${YELLOW}[4/7] Compilando programa Anchor...${NC}"
anchor build

echo -e "${GREEN}✓ Build completado${NC}"

# ── Paso 5: Obtener el Program ID ─────────────────────────────────────────

echo -e "\n${YELLOW}[5/7] Obteniendo Program ID...${NC}"

PROGRAM_ID=$(anchor keys list | grep agent_registry | awk '{print $2}')

if [ -z "$PROGRAM_ID" ]; then
  echo -e "${RED}✕ No se pudo obtener el Program ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Program ID: $PROGRAM_ID${NC}"

# Actualizar el declare_id! en lib.rs automáticamente
sed -i "s/AGNTos1111111111111111111111111111111111111/$PROGRAM_ID/g" \
  programs/agent-registry/src/lib.rs \
  Anchor.toml

echo -e "${GREEN}✓ Program ID actualizado en lib.rs y Anchor.toml${NC}"

# Rebuild con el ID correcto
anchor build

# ── Paso 6: Confirmación final antes del deploy ───────────────────────────

echo -e "\n${YELLOW}[6/7] CONFIRMACIÓN FINAL${NC}"
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  Red:        Solana MAINNET                 │"
echo "  │  Program ID: $PROGRAM_ID  │"
echo "  │  Deploy desde: $DEPLOY_PUBKEY  │"
echo "  │  Balance: $BALANCE_SOL SOL                  │"
echo "  │  Costo estimado: ~2-3 SOL (rent)            │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo -e "${RED}⚠️  ESTO ES MAINNET CON SOL REAL. NO SE PUEDE DESHACER.${NC}"
echo ""
read -p "¿Confirmar deploy? (escribe 'DEPLOY' para continuar): " CONFIRM

if [ "$CONFIRM" != "DEPLOY" ]; then
  echo "Deploy cancelado."
  exit 0
fi

# ── Paso 7: Deploy ────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[7/7] Desplegando en mainnet...${NC}"

anchor deploy --provider.cluster mainnet

echo -e "\n${GREEN}=================================================="
echo "  ✅ Deploy exitoso en Solana Mainnet"
echo "=================================================="
echo ""
echo "  Program ID: $PROGRAM_ID"
echo "  Explorer:   https://explorer.solana.com/address/$PROGRAM_ID"
echo ""
echo "  PRÓXIMOS PASOS:"
echo "  1. Actualizar NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID en .env"
echo "  2. Actualizar NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta en .env"
echo "  3. Actualizar USDC_MINT al mint real de USDC en mainnet"
echo "  4. Hacer redeploy del frontend en Vercel"
echo -e "==================================================${NC}"

# Guardar el Program ID en un archivo para referencia
echo "$PROGRAM_ID" > .program-id-mainnet
echo ""
echo "Program ID guardado en .program-id-mainnet"
