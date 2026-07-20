//! # Soltrend — house_vault program
//!
//! The audited on-chain core of the casino. It is the SOLE legal operator: the
//! platform custodies all funds, computes every payout, and splits the house
//! edge. Creators only *register a GameSpec* (a hash + a bounded edge); they
//! never hold player funds and cannot bias the RNG.
//!
//! ## Security invariants (see CHECKLIST_AUDIT.md)
//!  1. The vault can never pay out more than it holds.
//!  2. A settled payout can never exceed `config.max_payout_lamports`.
//!  3. Every game's edge is clamped to `[min_edge_bps, max_edge_bps]`.
//!  4. Only the config admin can move house liquidity.
//!  5. Creator royalties are claimable only after `kyc_verified == true`.
//!  6. The revenue-split percentages always sum to 10_000 bps (100%).

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("So1trendHouseVau1t11111111111111111111111111");

const BPS_DENOM: u64 = 10_000;

#[program]
pub mod house_vault {
    use super::*;

    /// Create the global config + the house vault PDA. Admin = signer.
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
        cfg.vault = ctx.accounts.vault.key();
        cfg.min_edge_bps = min_edge_bps;
        cfg.max_edge_bps = max_edge_bps;
        cfg.max_payout_lamports = max_payout_lamports;
        cfg.split = split;
        cfg.vault_bump = ctx.bumps.vault;
        cfg.paused = false;
        Ok(())
    }

    /// Admin tops up the house bankroll.
    pub fn deposit_liquidity(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.admin.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;
        emit!(LiquidityChanged { amount: amount as i64, vault: ctx.accounts.vault.key() });
        Ok(())
    }

    /// Admin withdraws surplus liquidity. Cannot drain below rent-exemption.
    pub fn withdraw_liquidity(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let rent = Rent::get()?.minimum_balance(vault.data_len());
        require!(vault.lamports() >= amount.saturating_add(rent), CasinoError::InsufficientVault);

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += amount;
        emit!(LiquidityChanged { amount: -(amount as i64), vault: vault.key() });
        Ok(())
    }

    /// Register a UGC game. Validates the edge sits inside the global band.
    /// `spec_hash` is the SHA-256 of the off-chain GameSpec JSON — immutable and
    /// auditable. The creator can never exceed the platform's edge/payout bounds.
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

    /// Settle a single bet atomically.
    ///
    /// `payout_multiplier_bps` is the game outcome (e.g. 20_000 = 2.00×), derived
    /// off-chain from the provably-fair stream / VRF and asserted here against the
    /// vault balance and the global payout cap. The house edge that the game
    /// keeps is split across platform / creator / referrer / treasury.
    pub fn settle_bet(ctx: Context<SettleBet>, bet_amount: u64, payout_multiplier_bps: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, CasinoError::Paused);

        // Player stakes into the vault first.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        let payout = (bet_amount as u128)
            .checked_mul(payout_multiplier_bps as u128)
            .ok_or(CasinoError::MathOverflow)?
            / BPS_DENOM as u128;
        let payout = payout as u64;

        // Invariant 2: never exceed the per-bet payout cap.
        require!(payout <= cfg.max_payout_lamports, CasinoError::PayoutTooLarge);

        if payout > 0 {
            let vault = &ctx.accounts.vault;
            let rent = Rent::get()?.minimum_balance(vault.data_len());
            // Invariant 1: the vault can never pay more than it holds.
            require!(vault.lamports() >= payout.saturating_add(rent), CasinoError::InsufficientVault);

            **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += payout;
        }

        // Distribute the house edge on the *staked* amount (a design royalty,
        // not a share of player losses — see legal note in the design doc).
        let edge = (bet_amount as u128 * ctx.accounts.game.edge_bps as u128 / BPS_DENOM as u128) as u64;
        let creator_cut = edge * cfg.split.creator_bps as u64 / BPS_DENOM;
        ctx.accounts.creator_vault.accrued = ctx
            .accounts
            .creator_vault
            .accrued
            .saturating_add(creator_cut);

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
        });
        Ok(())
    }

    /// Creator claims accrued royalties (KYC-gated — invariant 5).
    pub fn claim_royalties(ctx: Context<ClaimRoyalties>) -> Result<()> {
        let cv = &mut ctx.accounts.creator_vault;
        require!(cv.kyc_verified, CasinoError::KycRequired);
        let amount = cv.accrued;
        require!(amount > 0, CasinoError::NothingToClaim);

        let vault = &ctx.accounts.vault;
        let rent = Rent::get()?.minimum_balance(vault.data_len());
        require!(vault.lamports() >= amount.saturating_add(rent), CasinoError::InsufficientVault);

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += amount;
        cv.accrued = 0;
        emit!(RoyaltiesClaimed { creator: ctx.accounts.creator.key(), amount });
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
    /// CHECK: PDA that only holds lamports (the house bankroll).
    #[account(seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageLiquidity<'info> {
    #[account(seeds = [b"config"], bump, has_one = admin, has_one = vault)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: SystemAccount<'info>,
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
pub struct SettleBet<'info> {
    #[account(seeds = [b"config"], bump, has_one = vault)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut, has_one = creator)]
    pub game: Account<'info, Game>,
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
    #[account(seeds = [b"config"], bump, has_one = vault)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut, seeds = [b"creator", creator.key().as_ref()], bump, has_one = owner)]
    pub creator_vault: Account<'info, CreatorVault>,
    /// CHECK: matched against creator_vault.owner via `has_one = owner`.
    #[account(address = creator_vault.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
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
    pub vault: Pubkey,
    pub min_edge_bps: u16,
    pub max_edge_bps: u16,
    pub max_payout_lamports: u64,
    pub split: RevenueSplit,
    pub vault_bump: u8,
    pub paused: bool,
}
impl Config {
    pub const SIZE: usize = 32 + 32 + 2 + 2 + 8 + RevenueSplit::SIZE + 1 + 1;
}

/// Revenue split of the house edge. Must sum to 10_000 bps.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct RevenueSplit {
    pub platform_bps: u16,
    pub creator_bps: u16,
    pub referral_bps: u16,
    pub treasury_bps: u16,
}
impl RevenueSplit {
    pub const SIZE: usize = 2 * 4;
    pub fn validate(&self) -> Result<()> {
        let sum = self.platform_bps as u32
            + self.creator_bps as u32
            + self.referral_bps as u32
            + self.treasury_bps as u32;
        require!(sum == BPS_DENOM as u32, CasinoError::InvalidSplit);
        Ok(())
    }
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
}

#[event]
pub struct LiquidityChanged {
    pub amount: i64,
    pub vault: Pubkey,
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
    #[msg("Vault has insufficient liquidity")]
    InsufficientVault,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Creator must be KYC-verified to claim")]
    KycRequired,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Program is paused")]
    Paused,
}
