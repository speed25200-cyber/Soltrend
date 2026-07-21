//! # Soltrend — house_vault program
//!
//! The on-chain core of the community casino. The house is **not** the platform:
//! every game has its OWN bankroll pool, funded by community **stakers** who earn
//! the majority of that game's edge and carry its variance. The platform holds no
//! bankroll — it takes a small, risk-free rake. This is the zero-house-capital
//! model (see docs/TOKENOMICS.md) enforced on-chain.
//!
//! ## Security invariants (see CHECKLIST_AUDIT.md)
//!  1. A game pool can never pay out more than it holds (physical isolation: each
//!     pool is its own program-owned account; a game can only pay from its pool).
//!  2. A settled payout can never exceed `bankroll / RUIN_K` (staker protection)
//!     nor the absolute `config.max_payout_lamports` cap.
//!  3. Every game's edge is clamped to `[min_edge_bps, max_edge_bps]`.
//!  4. Staker shares are pro-rata on pool value (ERC-4626 style); yield accrues to
//!     shares, a lucky-player run reduces share value — no share can withdraw more
//!     than its fraction of the pool.
//!  5. The revenue-split percentages always sum to 10_000 bps; only the non-staker
//!     cuts (creator + platform + insurance) leave the pool, into the treasury.
//!  6. Creator royalties are claimable only after `kyc_verified == true`.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const BPS_DENOM: u64 = 10_000;
/// Max payout is capped at 1/RUIN_K of a pool's bankroll, so one lucky player can
/// never drain the stakers. This is what lets a game open on a tiny bankroll.
const RUIN_K: u64 = 5;

#[program]
pub mod house_vault {
    use super::*;

    /// Create the global config + the protocol treasury PDA. Admin = signer.
    pub fn init_config(
        ctx: Context<InitConfig>,
        min_edge_bps: u16,
        max_edge_bps: u16,
        max_payout_lamports: u64,
        split: RevenueSplit,
    ) -> Result<()> {
        require!(min_edge_bps <= max_edge_bps, CasinoError::InvalidEdgeBand);
        require!(max_edge_bps <= 2_000, CasinoError::InvalidEdgeBand); // hard cap 20%
        split.validate()?;

        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.treasury = ctx.accounts.treasury.key();
        cfg.min_edge_bps = min_edge_bps;
        cfg.max_edge_bps = max_edge_bps;
        cfg.max_payout_lamports = max_payout_lamports;
        cfg.split = split;
        cfg.paused = false;

        let t = &mut ctx.accounts.treasury;
        t.platform_accrued = 0;
        t.insurance_accrued = 0;
        t.bump = ctx.bumps.treasury;
        Ok(())
    }

    /// Register a UGC game + create its (empty) bankroll pool. Edge is clamped to
    /// the global band; `spec_hash` is the SHA-256 of the off-chain GameSpec.
    pub fn register_game(
        ctx: Context<RegisterGame>,
        spec_hash: [u8; 32],
        edge_bps: u16,
        template: u8,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(
            edge_bps >= cfg.min_edge_bps && edge_bps <= cfg.max_edge_bps,
            CasinoError::EdgeOutOfBand
        );

        let game = &mut ctx.accounts.game;
        game.creator = ctx.accounts.creator.key();
        game.spec_hash = spec_hash;
        game.edge_bps = edge_bps;
        game.template = template;
        game.total_volume = 0;
        game.total_plays = 0;

        let pool = &mut ctx.accounts.pool;
        pool.game = game.key();
        pool.total_shares = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// One-time creator profile PDA (holds accrued royalties + KYC flag).
    pub fn init_creator(ctx: Context<InitCreator>) -> Result<()> {
        let c = &mut ctx.accounts.creator_vault;
        c.owner = ctx.accounts.creator.key();
        c.accrued = 0;
        c.kyc_verified = false;
        Ok(())
    }

    /// Admin/compliance marks a creator KYC-verified, unlocking claims.
    pub fn set_kyc(ctx: Context<SetKyc>, verified: bool) -> Result<()> {
        ctx.accounts.creator_vault.kyc_verified = verified;
        Ok(())
    }

    /* --------------------------------------------------------------- staking */

    /// Stake SOL into a game's bankroll pool. Mints pro-rata shares (invariant 4):
    /// shares = amount * total_shares / pool_value  (or `amount` for the first).
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, CasinoError::ZeroAmount);
        let pool_ai = ctx.accounts.pool.to_account_info();
        let rent = Rent::get()?.minimum_balance(pool_ai.data_len());
        let value = pool_ai.lamports().saturating_sub(rent) as u128;

        let minted: u128 = if ctx.accounts.pool.total_shares == 0 || value == 0 {
            amount as u128
        } else {
            (amount as u128)
                .checked_mul(ctx.accounts.pool.total_shares)
                .ok_or(CasinoError::MathOverflow)?
                / value
        };
        require!(minted > 0, CasinoError::ZeroShares);

        // Staker funds the pool.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.staker.to_account_info(),
                    to: pool_ai.clone(),
                },
            ),
            amount,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.total_shares = pool.total_shares.checked_add(minted).ok_or(CasinoError::MathOverflow)?;
        let pos = &mut ctx.accounts.position;
        pos.pool = pool.key();
        pos.owner = ctx.accounts.staker.key();
        pos.shares = pos.shares.checked_add(minted).ok_or(CasinoError::MathOverflow)?;

        emit!(Staked { pool: pool.key(), staker: ctx.accounts.staker.key(), amount, shares: minted });
        Ok(())
    }

    /// Burn shares and withdraw the pro-rata pool value. Cannot take a pool below
    /// its rent-exemption.
    pub fn unstake(ctx: Context<Unstake>, shares: u128) -> Result<()> {
        require!(shares > 0, CasinoError::ZeroShares);
        require!(shares <= ctx.accounts.position.shares, CasinoError::InsufficientShares);

        let pool_ai = ctx.accounts.pool.to_account_info();
        let rent = Rent::get()?.minimum_balance(pool_ai.data_len());
        let value = pool_ai.lamports().saturating_sub(rent) as u128;
        let total = ctx.accounts.pool.total_shares.max(1);
        let amount = (shares.checked_mul(value).ok_or(CasinoError::MathOverflow)? / total) as u64;

        require!(pool_ai.lamports() >= amount.saturating_add(rent), CasinoError::InsufficientVault);

        **pool_ai.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.staker.to_account_info().try_borrow_mut_lamports()? += amount;

        let pool = &mut ctx.accounts.pool;
        pool.total_shares = pool.total_shares.saturating_sub(shares);
        let pos = &mut ctx.accounts.position;
        pos.shares = pos.shares.saturating_sub(shares);

        emit!(Unstaked { pool: pool.key(), staker: ctx.accounts.staker.key(), amount, shares });
        Ok(())
    }

    /* -------------------------------------------------------------- settle */

    /// Settle a single bet against the game's pool.
    ///
    /// `payout_multiplier_bps` is the provably-fair outcome (20_000 = 2.00×). The
    /// payout comes FROM the game's pool and is capped at `bankroll / RUIN_K`
    /// (invariant 2). The house edge is split: the staker share (60%) stays in the
    /// pool as yield; the creator/platform/insurance cuts move to the treasury.
    pub fn settle_bet(ctx: Context<SettleBet>, bet_amount: u64, payout_multiplier_bps: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, CasinoError::Paused);
        require!(bet_amount > 0, CasinoError::ZeroAmount);

        let pool_ai = ctx.accounts.pool.to_account_info();
        let rent = Rent::get()?.minimum_balance(pool_ai.data_len());

        // Bankroll BEFORE this bet — the staker capital the cap must protect.
        let bankroll = pool_ai.lamports().saturating_sub(rent);

        let payout = ((bet_amount as u128)
            .checked_mul(payout_multiplier_bps as u128)
            .ok_or(CasinoError::MathOverflow)?
            / BPS_DENOM as u128) as u64;

        // Invariant 2: bankroll-relative cap AND absolute cap.
        require!(
            (payout as u128) * (RUIN_K as u128) <= bankroll as u128,
            CasinoError::BankrollCapExceeded
        );
        require!(payout <= cfg.max_payout_lamports, CasinoError::PayoutTooLarge);

        // Edge split — the non-staker cuts that leave the pool for the treasury.
        let edge = (bet_amount as u128 * ctx.accounts.game.edge_bps as u128 / BPS_DENOM as u128) as u64;
        let creator_cut = edge * cfg.split.creator_bps as u64 / BPS_DENOM;
        let platform_cut = edge * cfg.split.platform_bps as u64 / BPS_DENOM;
        let insurance_cut = edge * cfg.split.insurance_bps as u64 / BPS_DENOM;
        let skim = creator_cut + platform_cut + insurance_cut;

        // Player stakes into the pool.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: pool_ai.clone(),
                },
            ),
            bet_amount,
        )?;

        // Pay the player from the pool (invariant 1).
        if payout > 0 {
            require!(pool_ai.lamports() >= payout.saturating_add(rent), CasinoError::InsufficientVault);
            **pool_ai.try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += payout;
        }

        // Move the non-staker edge cuts pool → treasury (staker 60% stays as yield).
        if skim > 0 {
            require!(pool_ai.lamports() >= skim.saturating_add(rent), CasinoError::InsufficientVault);
            **pool_ai.try_borrow_mut_lamports()? -= skim;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += skim;
        }

        ctx.accounts.creator_vault.accrued = ctx.accounts.creator_vault.accrued.saturating_add(creator_cut);
        let t = &mut ctx.accounts.treasury;
        t.platform_accrued = t.platform_accrued.saturating_add(platform_cut);
        t.insurance_accrued = t.insurance_accrued.saturating_add(insurance_cut);

        let game = &mut ctx.accounts.game;
        game.total_volume = game.total_volume.saturating_add(bet_amount);
        game.total_plays = game.total_plays.saturating_add(1);

        emit!(BetSettled {
            player: ctx.accounts.player.key(),
            game: game.key(),
            bet_amount,
            payout,
            edge,
            creator_cut,
            platform_cut,
            insurance_cut,
        });
        Ok(())
    }

    /* --------------------------------------------------------------- claims */

    /// Creator claims accrued royalties from the treasury (KYC-gated — invariant 6).
    pub fn claim_royalties(ctx: Context<ClaimRoyalties>) -> Result<()> {
        let cv = &mut ctx.accounts.creator_vault;
        require!(cv.kyc_verified, CasinoError::KycRequired);
        let amount = cv.accrued;
        require!(amount > 0, CasinoError::NothingToClaim);

        let treasury_ai = ctx.accounts.treasury.to_account_info();
        let rent = Rent::get()?.minimum_balance(treasury_ai.data_len());
        require!(treasury_ai.lamports() >= amount.saturating_add(rent), CasinoError::InsufficientVault);

        **treasury_ai.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += amount;
        cv.accrued = 0;
        emit!(RoyaltiesClaimed { creator: ctx.accounts.creator.key(), amount });
        Ok(())
    }

    /// Admin claims the accrued platform rake from the treasury (insurance stays).
    pub fn claim_platform(ctx: Context<ClaimProtocol>) -> Result<()> {
        let treasury_ai = ctx.accounts.treasury.to_account_info();
        let rent = Rent::get()?.minimum_balance(treasury_ai.data_len());
        let amount = ctx.accounts.treasury.platform_accrued;
        require!(amount > 0, CasinoError::NothingToClaim);
        require!(treasury_ai.lamports() >= amount.saturating_add(rent), CasinoError::InsufficientVault);

        **treasury_ai.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += amount;
        ctx.accounts.treasury.platform_accrued = 0;
        Ok(())
    }

    /// Emergency circuit-breaker.
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }
}

/* ------------------------------------------------------------------ accounts */

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = admin, space = 8 + Config::SIZE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + Treasury::SIZE, seeds = [b"treasury"], bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(spec_hash: [u8; 32])]
pub struct RegisterGame<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = creator,
        space = 8 + Game::SIZE,
        seeds = [b"game", creator.key().as_ref(), spec_hash.as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(
        init,
        payer = creator,
        space = 8 + GamePool::SIZE,
        seeds = [b"pool", game.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, GamePool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitCreator<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + CreatorVault::SIZE,
        seeds = [b"creator", creator.key().as_ref()],
        bump
    )]
    pub creator_vault: Account<'info, CreatorVault>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetKyc<'info> {
    #[account(seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub creator_vault: Account<'info, CreatorVault>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"pool", pool.game.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, GamePool>,
    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakePosition::SIZE,
        seeds = [b"stake", pool.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(mut)]
    pub staker: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"pool", pool.game.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, GamePool>,
    #[account(
        mut,
        seeds = [b"stake", pool.key().as_ref(), staker.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub position: Account<'info, StakePosition>,
    /// CHECK: matched against position.owner via `has_one = owner`.
    #[account(address = position.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(mut, address = position.owner)]
    pub staker: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(seeds = [b"config"], bump, has_one = treasury)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut, has_one = creator, address = pool.game)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [b"pool", game.key().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, GamePool>,
    /// CHECK: creator key is validated via `game.has_one = creator`.
    pub creator: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"creator", creator.key().as_ref()], bump)]
    pub creator_vault: Account<'info, CreatorVault>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRoyalties<'info> {
    #[account(seeds = [b"config"], bump, has_one = treasury)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut, seeds = [b"creator", creator.key().as_ref()], bump, has_one = owner)]
    pub creator_vault: Account<'info, CreatorVault>,
    /// CHECK: matched against creator_vault.owner via `has_one = owner`.
    #[account(address = creator_vault.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimProtocol<'info> {
    #[account(seeds = [b"config"], bump, has_one = admin, has_one = treasury)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

/* -------------------------------------------------------------------- state */

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub min_edge_bps: u16,
    pub max_edge_bps: u16,
    pub max_payout_lamports: u64,
    pub split: RevenueSplit,
    pub paused: bool,
}
impl Config {
    pub const SIZE: usize = 32 + 32 + 2 + 2 + 8 + RevenueSplit::SIZE + 1;
}

/// Split of the house edge. Must sum to 10_000 bps. Staker-favoured: only the
/// non-staker cuts leave the pool; `bankroll_bps` is the residual kept as yield.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct RevenueSplit {
    pub bankroll_bps: u16,   // stakers — stays in the pool (e.g. 6000)
    pub creator_bps: u16,    // e.g. 2000
    pub platform_bps: u16,   // e.g. 1500
    pub insurance_bps: u16,  // e.g. 500
}
impl RevenueSplit {
    pub const SIZE: usize = 2 * 4;
    pub fn validate(&self) -> Result<()> {
        let sum = self.bankroll_bps as u32
            + self.creator_bps as u32
            + self.platform_bps as u32
            + self.insurance_bps as u32;
        require!(sum == BPS_DENOM as u32, CasinoError::InvalidSplit);
        Ok(())
    }
}

/// Protocol treasury — holds skimmed edge (platform + insurance + pending creator
/// royalties) awaiting claim. The platform never holds bankroll variance.
#[account]
pub struct Treasury {
    pub platform_accrued: u64,
    pub insurance_accrued: u64,
    pub bump: u8,
}
impl Treasury {
    pub const SIZE: usize = 8 + 8 + 1;
}

#[account]
pub struct Game {
    pub creator: Pubkey,
    pub spec_hash: [u8; 32],
    pub edge_bps: u16,
    pub template: u8,
    pub total_volume: u64,
    pub total_plays: u64,
}
impl Game {
    pub const SIZE: usize = 32 + 32 + 2 + 1 + 8 + 8;
}

/// Per-game bankroll. A program-owned account that also holds the pool's lamports;
/// `total_shares` tracks staker ownership pro-rata on the pool's value.
#[account]
pub struct GamePool {
    pub game: Pubkey,
    pub total_shares: u128,
    pub bump: u8,
}
impl GamePool {
    pub const SIZE: usize = 32 + 16 + 1;
}

#[account]
pub struct StakePosition {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub shares: u128,
}
impl StakePosition {
    pub const SIZE: usize = 32 + 32 + 16;
}

#[account]
pub struct CreatorVault {
    pub owner: Pubkey,
    pub accrued: u64,
    pub kyc_verified: bool,
}
impl CreatorVault {
    pub const SIZE: usize = 32 + 8 + 1;
}

/* ------------------------------------------------------------------- events */

#[event]
pub struct BetSettled {
    pub player: Pubkey,
    pub game: Pubkey,
    pub bet_amount: u64,
    pub payout: u64,
    pub edge: u64,
    pub creator_cut: u64,
    pub platform_cut: u64,
    pub insurance_cut: u64,
}

#[event]
pub struct Staked {
    pub pool: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub shares: u128,
}

#[event]
pub struct Unstaked {
    pub pool: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub shares: u128,
}

#[event]
pub struct RoyaltiesClaimed {
    pub creator: Pubkey,
    pub amount: u64,
}

/* ------------------------------------------------------------------- errors */

#[error_code]
pub enum CasinoError {
    #[msg("Edge band is invalid")]
    InvalidEdgeBand,
    #[msg("Revenue split must sum to 100%")]
    InvalidSplit,
    #[msg("Game edge is outside the allowed band")]
    EdgeOutOfBand,
    #[msg("Payout exceeds the per-bet cap")]
    PayoutTooLarge,
    #[msg("Payout exceeds the pool's bankroll cap (1/RUIN_K)")]
    BankrollCapExceeded,
    #[msg("Vault has insufficient liquidity")]
    InsufficientVault,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Share amount rounds to zero")]
    ZeroShares,
    #[msg("Not enough shares")]
    InsufficientShares,
    #[msg("Creator must be KYC-verified to claim")]
    KycRequired,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Program is paused")]
    Paused,
}
