use anchor_lang::prelude::*;

declare_id!("BF3gD81vZR7XMkbnNoWQxwEMRG4ieBA46KNW2o3X3Gdv");

#[program]
pub mod agent_registry {
    use super::*;

    /// Crea un nuevo agente y lo registra on-chain
    pub fn create_agent(
        ctx: Context<CreateAgent>,
        params: CreateAgentParams,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        require!(params.name.len() <= 50, AgentError::NameTooLong);
        require!(params.name.len() > 0, AgentError::NameEmpty);
        require!(params.template <= 2, AgentError::InvalidTemplate);
        require!(params.price_per_use >= 0, AgentError::InvalidPrice);

        agent.owner           = ctx.accounts.owner.key();
        agent.agent_id        = params.agent_id;
        agent.name            = params.name;
        agent.template        = params.template;  // 0=Responder, 1=DeFi, 2=Content
        agent.price_lamports  = params.price_per_use;
        agent.access_type     = params.access_type; // 0=Public, 1=NFT-Gated
        agent.nft_collection  = params.nft_collection;
        agent.config_hash     = params.config_hash; // sha256 del system prompt en Supabase
        agent.status          = AgentStatus::Active;
        agent.revenue_total   = 0;
        agent.uses_total      = 0;
        agent.created_at      = clock.unix_timestamp;
        agent.updated_at      = clock.unix_timestamp;
        agent.bump            = ctx.bumps.agent;

        emit!(AgentCreated {
            owner:     agent.owner,
            agent_id:  agent.agent_id,
            name:      agent.name.clone(),
            template:  agent.template,
            created_at: agent.created_at,
        });

        msg!("Agente '{}' creado por {}", agent.name, agent.owner);
        Ok(())
    }

    /// Registra un pago recibido via x402 (llamado por el worker off-chain)
    pub fn record_payment(
        ctx: Context<RecordPayment>,
        amount: u64,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        require!(
            agent.status == AgentStatus::Active,
            AgentError::AgentNotActive
        );

        agent.revenue_total = agent.revenue_total.checked_add(amount)
            .ok_or(AgentError::Overflow)?;
        agent.uses_total = agent.uses_total.checked_add(1)
            .ok_or(AgentError::Overflow)?;
        agent.updated_at = clock.unix_timestamp;

        emit!(PaymentRecorded {
            agent_id: agent.agent_id,
            owner:    agent.owner,
            amount,
            uses_total: agent.uses_total,
        });

        Ok(())
    }

    /// Pausa o activa el agente (solo el owner)
    pub fn set_status(
        ctx: Context<UpdateAgent>,
        status: u8,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        agent.status = match status {
            0 => AgentStatus::Active,
            1 => AgentStatus::Paused,
            _ => return Err(AgentError::InvalidStatus.into()),
        };
        agent.updated_at = clock.unix_timestamp;

        msg!("Agente {} status actualizado a {:?}", agent.agent_id, agent.status);
        Ok(())
    }

    /// Actualiza el precio por uso (solo el owner)
    pub fn update_price(
        ctx: Context<UpdateAgent>,
        new_price: u64,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        agent.price_lamports = new_price;
        agent.updated_at = clock.unix_timestamp;

        msg!("Precio actualizado a {} lamports", new_price);
        Ok(())
    }

    /// Actualiza el config_hash cuando el owner cambia el system prompt
    pub fn update_config(
        ctx: Context<UpdateAgent>,
        new_config_hash: [u8; 32],
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        agent.config_hash = new_config_hash;
        agent.updated_at = clock.unix_timestamp;

        emit!(ConfigUpdated {
            agent_id:    agent.agent_id,
            config_hash: agent.config_hash,
            updated_at:  agent.updated_at,
        });

        Ok(())
    }

    /// Cierra la cuenta del agente y devuelve lamports al owner
    pub fn close_agent(_ctx: Context<CloseAgent>) -> Result<()> {
        msg!("Agente cerrado y lamports devueltos al owner");
        Ok(())
    }
}

// ============================================================
// ACCOUNTS
// ============================================================

#[derive(Accounts)]
#[instruction(params: CreateAgentParams)]
pub struct CreateAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = AgentAccount::SIZE,
        seeds = [b"agent", owner.key().as_ref(), params.agent_id.to_le_bytes().as_ref()],
        bump
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordPayment<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.owner.as_ref(), agent.agent_id.to_le_bytes().as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, AgentAccount>,

    // Worker autorizado por el owner (off-chain signer)
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref(), agent.agent_id.to_le_bytes().as_ref()],
        bump = agent.bump,
        has_one = owner @ AgentError::Unauthorized,
    )]
    pub agent: Account<'info, AgentAccount>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseAgent<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"agent", owner.key().as_ref(), agent.agent_id.to_le_bytes().as_ref()],
        bump = agent.bump,
        has_one = owner @ AgentError::Unauthorized,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

// ============================================================
// STATE
// ============================================================

#[account]
pub struct AgentAccount {
    pub owner:          Pubkey,      // 32 — wallet del creador
    pub agent_id:       u64,         // 8  — id único (unix timestamp al crear)
    pub name:           String,      // 4 + 50
    pub template:       u8,          // 1  — 0=Responder, 1=DeFi, 2=Content
    pub price_lamports: u64,         // 8  — precio en lamports (USDC micro)
    pub access_type:    u8,          // 1  — 0=Public, 1=NFT-Gated
    pub nft_collection: Option<Pubkey>, // 1 + 32
    pub config_hash:    [u8; 32],    // 32 — sha256 del system prompt en Supabase
    pub status:         AgentStatus, // 1
    pub revenue_total:  u64,         // 8  — total recaudado (lamports)
    pub uses_total:     u64,         // 8  — total de usos
    pub created_at:     i64,         // 8
    pub updated_at:     i64,         // 8
    pub bump:           u8,          // 1
}

impl AgentAccount {
    // 8 discriminator + todos los campos
    pub const SIZE: usize = 8 + 32 + 8 + (4 + 50) + 1 + 8 + 1 + (1 + 32) + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 64; // +64 padding
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum AgentStatus {
    Active,
    Paused,
}

// ============================================================
// PARAMS
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateAgentParams {
    pub agent_id:       u64,
    pub name:           String,
    pub template:       u8,
    pub price_per_use:  u64,
    pub access_type:    u8,
    pub nft_collection: Option<Pubkey>,
    pub config_hash:    [u8; 32],
}

// ============================================================
// EVENTS
// ============================================================

#[event]
pub struct AgentCreated {
    pub owner:      Pubkey,
    pub agent_id:   u64,
    pub name:       String,
    pub template:   u8,
    pub created_at: i64,
}

#[event]
pub struct PaymentRecorded {
    pub agent_id:   u64,
    pub owner:      Pubkey,
    pub amount:     u64,
    pub uses_total: u64,
}

#[event]
pub struct ConfigUpdated {
    pub agent_id:    u64,
    pub config_hash: [u8; 32],
    pub updated_at:  i64,
}

// ============================================================
// ERRORS
// ============================================================

#[error_code]
pub enum AgentError {
    #[msg("No autorizado: solo el owner puede realizar esta acción")]
    Unauthorized,
    #[msg("El agente no está activo")]
    AgentNotActive,
    #[msg("Nombre demasiado largo (máx 50 caracteres)")]
    NameTooLong,
    #[msg("El nombre no puede estar vacío")]
    NameEmpty,
    #[msg("Template inválido (0=Responder, 1=DeFi, 2=Content)")]
    InvalidTemplate,
    #[msg("Precio inválido")]
    InvalidPrice,
    #[msg("Status inválido (0=Active, 1=Paused)")]
    InvalidStatus,
    #[msg("Overflow en el cálculo")]
    Overflow,
}
