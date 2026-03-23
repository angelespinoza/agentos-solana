import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { createHash } from "crypto";

// ── IDL types (generados por anchor build) ──────────────────────────────────
export type AgentTemplate = 0 | 1 | 2;
export type AccessType = 0 | 1; // 0 = Public, 1 = NFT-Gated

export interface CreateAgentInput {
  name: string;
  template: AgentTemplate;       // 0=Responder, 1=DeFi, 2=Content
  priceUsdc: number;             // en USDC (ej: 0.01)
  accessType: AccessType;
  nftCollection?: string;        // PublicKey string si es NFT-Gated
  systemPrompt: string;          // Se hashea y guarda on-chain
}

export interface AgentOnChain {
  publicKey: PublicKey;
  owner: PublicKey;
  agentId: BN;
  name: string;
  template: number;
  priceLamports: BN;
  accessType: number;
  nftCollection: PublicKey | null;
  configHash: number[];
  status: { active?: {} } | { paused?: {} };
  revenueTotal: BN;
  usesTotal: BN;
  createdAt: BN;
  updatedAt: BN;
}

// ── Constants ───────────────────────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey("AGNTos1111111111111111111111111111111111111");
export const USDC_DECIMALS = 6;
export const USDC_TO_LAMPORTS = 10 ** USDC_DECIMALS;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte USDC a lamports (micro USDC) */
export const usdcToLamports = (usdc: number): BN =>
  new BN(Math.floor(usdc * USDC_TO_LAMPORTS));

/** Convierte lamports a USDC legible */
export const lamportsToUsdc = (lamports: BN): number =>
  lamports.toNumber() / USDC_TO_LAMPORTS;

/** SHA-256 del system prompt → [u8; 32] para guardar on-chain */
export const hashSystemPrompt = (prompt: string): number[] => {
  const hash = createHash("sha256").update(prompt).digest();
  return Array.from(hash);
};

/** Deriva el PDA del agente */
export const deriveAgentPDA = (
  owner: PublicKey,
  agentId: BN
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("agent"),
      owner.toBuffer(),
      agentId.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
};

// ── Provider ────────────────────────────────────────────────────────────────

export const getProvider = (wallet: WalletContextState, connection: Connection) => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet no conectada");
  }

  return new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions!,
    },
    { commitment: "confirmed" }
  );
};

// ── Main Client Class ────────────────────────────────────────────────────────

export class AgentOSClient {
  private program!: Program;
  private connection!: Connection;
  private wallet!: WalletContextState;

  constructor(wallet: WalletContextState, network: "devnet" | "mainnet-beta" = "devnet") {
    this.wallet = wallet;
    this.connection = new Connection(clusterApiUrl(network), "confirmed");
    const provider = getProvider(wallet, this.connection);
    // Program se inicializa con el IDL generado por anchor build
    // this.program = new Program(IDL, PROGRAM_ID, provider);
  }

  /**
   * Crea un nuevo agente on-chain
   * Retorna la tx signature y el PDA del agente
   */
  async createAgent(input: CreateAgentInput): Promise<{
    signature: string;
    agentPDA: PublicKey;
    agentId: BN;
  }> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");

    const agentId = new BN(Date.now()); // unique id = timestamp
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);
    const configHash = hashSystemPrompt(input.systemPrompt);

    const params = {
      agentId,
      name: input.name,
      template: input.template,
      pricePerUse: usdcToLamports(input.priceUsdc),
      accessType: input.accessType,
      nftCollection: input.nftCollection
        ? new PublicKey(input.nftCollection)
        : null,
      configHash,
    };

    const signature = await this.program.methods
      .createAgent(params)
      .accounts({
        agent: agentPDA,
        owner: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, agentPDA, agentId };
  }

  /**
   * Pausa un agente (solo el owner)
   */
  async pauseAgent(agentId: BN): Promise<string> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);

    return this.program.methods
      .setStatus(1) // 1 = Paused
      .accounts({ agent: agentPDA, owner: this.wallet.publicKey })
      .rpc();
  }

  /**
   * Activa un agente pausado (solo el owner)
   */
  async activateAgent(agentId: BN): Promise<string> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);

    return this.program.methods
      .setStatus(0) // 0 = Active
      .accounts({ agent: agentPDA, owner: this.wallet.publicKey })
      .rpc();
  }

  /**
   * Actualiza el precio por uso (solo el owner)
   */
  async updatePrice(agentId: BN, newPriceUsdc: number): Promise<string> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);

    return this.program.methods
      .updatePrice(usdcToLamports(newPriceUsdc))
      .accounts({ agent: agentPDA, owner: this.wallet.publicKey })
      .rpc();
  }

  /**
   * Actualiza el config hash cuando el owner cambia el system prompt
   */
  async updateConfig(agentId: BN, newSystemPrompt: string): Promise<string> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);
    const newHash = hashSystemPrompt(newSystemPrompt);

    return this.program.methods
      .updateConfig(newHash)
      .accounts({ agent: agentPDA, owner: this.wallet.publicKey })
      .rpc();
  }

  /**
   * Cierra el agente y recupera los lamports de rent
   */
  async closeAgent(agentId: BN): Promise<string> {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    const [agentPDA] = deriveAgentPDA(this.wallet.publicKey, agentId);

    return this.program.methods
      .closeAgent()
      .accounts({
        agent: agentPDA,
        owner: this.wallet.publicKey,
      })
      .rpc();
  }

  /**
   * Obtiene todos los agentes de un owner
   */
  async getAgentsByOwner(owner: PublicKey): Promise<AgentOnChain[]> {
    const accounts = await (this.program.account as any).agentAccount.all([
      {
        memcmp: {
          offset: 8, // después del discriminator
          bytes: owner.toBase58(),
        },
      },
    ]);

    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      ...(a.account as any),
    }));
  }

  /**
   * Obtiene todos los agentes activos (para el marketplace)
   */
  async getAllActiveAgents(): Promise<AgentOnChain[]> {
    const accounts = await (this.program.account as any).agentAccount.all();
    return accounts
      .filter((a) => (a.account as any).status?.active !== undefined)
      .map((a) => ({ publicKey: a.publicKey, ...(a.account as any) }));
  }

  /**
   * Obtiene un agente específico por su PDA
   */
  async getAgent(agentPDA: PublicKey): Promise<AgentOnChain | null> {
    try {
      const account = await (this.program.account as any).agentAccount.fetch(agentPDA);
      return { publicKey: agentPDA, ...(account as any) };
    } catch {
      return null;
    }
  }
}

// ── Template Metadata ────────────────────────────────────────────────────────

export const AGENT_TEMPLATES = [
  {
    id: 0,
    name: "Agente Respondedor",
    description: "Responde preguntas sobre un tema específico y cobra por respuesta",
    icon: "🤖",
    defaultPrice: 0.01,
    color: "#9945FF",
  },
  {
    id: 1,
    name: "Agente Monitor DeFi",
    description: "Monitorea precios on-chain y ejecuta alertas automáticas",
    icon: "📈",
    defaultPrice: 0.05,
    color: "#14F195",
  },
  {
    id: 2,
    name: "Agente de Contenido",
    description: "Genera y publica contenido automáticamente según un schedule",
    icon: "📢",
    defaultPrice: 0.02,
    color: "#00C2FF",
  },
] as const;

export const getTemplateMeta = (id: number) =>
  AGENT_TEMPLATES.find((t) => t.id === id) ?? AGENT_TEMPLATES[0];
