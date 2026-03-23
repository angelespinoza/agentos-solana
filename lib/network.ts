/**
 * AgentOS — Network Config
 *
 * Fuente única de verdad para toda la configuración de red.
 * Cambia NEXT_PUBLIC_SOLANA_NETWORK en .env para cambiar entre devnet y mainnet.
 */

export type SolanaNetwork = "devnet" | "mainnet-beta";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as SolanaNetwork;

// ── Direcciones por red ───────────────────────────────────────────────────

const CONFIG = {
  "devnet": {
    network:          "devnet"          as SolanaNetwork,
    clusterApiUrl:    "https://api.devnet.solana.com",
    x402Network:      "solana:devnet",
    usdcMint:         "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJ", // devnet USDC (test)
    explorerBase:     "https://explorer.solana.com?cluster=devnet",
    programId:        process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AGNTos1111111111111111111111111111111111111",
    label:            "Devnet",
    isMainnet:        false,
  },
  "mainnet-beta": {
    network:          "mainnet-beta"    as SolanaNetwork,
    clusterApiUrl:    process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    x402Network:      "solana:mainnet", // identificador CAIP-2 para x402
    usdcMint:         "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mainnet oficial
    explorerBase:     "https://explorer.solana.com",
    programId:        process.env.NEXT_PUBLIC_PROGRAM_ID ?? "REEMPLAZAR_CON_PROGRAM_ID_REAL",
    label:            "Mainnet",
    isMainnet:        true,
  },
} as const;

export const networkConfig = CONFIG[NETWORK];

// ── Helpers ───────────────────────────────────────────────────────────────

export const getTxUrl = (txHash: string) =>
  `${networkConfig.explorerBase}/tx/${txHash}`;

export const getAddressUrl = (address: string) =>
  `${networkConfig.explorerBase}/address/${address}`;

export const isMainnet = () => networkConfig.isMainnet;

// Advertencia en consola si estás en mainnet
if (typeof window === "undefined" && networkConfig.isMainnet) {
  console.log("🔴 AgentOS corriendo en SOLANA MAINNET");
}
