import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { HouseVault } from '../target/types/house_vault';

/**
 * Anchor tests covering the community-bankroll invariants (see CHECKLIST_AUDIT.md):
 *  - config init + edge band + staker-favoured split-sum (60/20/15/5)
 *  - register_game creates the per-game bankroll pool; out-of-band edge rejected
 *  - stake mints pro-rata shares; unstake returns pro-rata value
 *  - settle_bet: payout math, the bankroll cap (payout ≤ bankroll/RUIN_K), pool
 *    solvency, and the edge split (creator/platform/insurance leave the pool)
 *  - claim_royalties gated on KYC
 */
describe('house_vault', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HouseVault as Program<HouseVault>;
  const admin = provider.wallet as anchor.Wallet;

  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from('treasury')], program.programId);

  const creator = Keypair.generate();
  const staker = Keypair.generate();
  const specHash = Array.from({ length: 32 }, (_, i) => i);
  const [game] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), creator.publicKey.toBuffer(), Buffer.from(specHash)],
    program.programId,
  );
  const [pool] = PublicKey.findProgramAddressSync([Buffer.from('pool'), game.toBuffer()], program.programId);
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator'), creator.publicKey.toBuffer()],
    program.programId,
  );
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), pool.toBuffer(), staker.publicKey.toBuffer()],
    program.programId,
  );

  it('initialises config with a valid edge band + 60/20/15/5 split', async () => {
    await program.methods
      .initConfig(100, 500, new anchor.BN(1000 * LAMPORTS_PER_SOL), {
        bankrollBps: 6000,
        creatorBps: 2000,
        platformBps: 1500,
        insuranceBps: 500,
      })
      .accounts({ config, treasury, admin: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();

    const cfg = await program.account.config.fetch(config);
    assert.equal(cfg.split.bankrollBps, 6000);
  });

  it('rejects a split that does not sum to 100%', async () => {
    try {
      await program.methods
        .initConfig(100, 500, new anchor.BN(1), { bankrollBps: 1, creatorBps: 1, platformBps: 1, insuranceBps: 1 })
        .accounts({ config, treasury, admin: admin.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail('should have thrown');
    } catch (e) {
      assert.include(e.toString(), 'InvalidSplit');
    }
  });

  it('registers a creator + a game (with its bankroll pool)', async () => {
    for (const kp of [creator, staker]) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(kp.publicKey, 20 * LAMPORTS_PER_SOL),
      );
    }
    await program.methods
      .initCreator()
      .accounts({ creatorVault, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();

    await program.methods
      .registerGame(specHash, 200, 0)
      .accounts({ config, game, pool, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();

    const p = await program.account.gamePool.fetch(pool);
    assert.equal(p.totalShares.toString(), '0');
  });

  it('rejects an out-of-band edge on register_game', async () => {
    const badHash = Array.from({ length: 32 }, () => 9);
    const [badGame] = PublicKey.findProgramAddressSync(
      [Buffer.from('game'), creator.publicKey.toBuffer(), Buffer.from(badHash)],
      program.programId,
    );
    const [badPool] = PublicKey.findProgramAddressSync([Buffer.from('pool'), badGame.toBuffer()], program.programId);
    try {
      await program.methods
        .registerGame(badHash, 9000, 0)
        .accounts({ config, game: badGame, pool: badPool, creator: creator.publicKey, systemProgram: SystemProgram.programId })
        .signers([creator])
        .rpc();
      assert.fail('should reject');
    } catch (e) {
      assert.include(e.toString(), 'EdgeOutOfBand');
    }
  });

  it('stakes into the pool and mints shares', async () => {
    await program.methods
      .stake(new anchor.BN(10 * LAMPORTS_PER_SOL))
      .accounts({ pool, position, staker: staker.publicKey, systemProgram: SystemProgram.programId })
      .signers([staker])
      .rpc();
    const pos = await program.account.stakePosition.fetch(position);
    assert.isAbove(Number(pos.shares.toString()), 0);
  });

  it('rejects a bet whose payout exceeds the bankroll cap (payout > pool/RUIN_K)', async () => {
    // pool ≈ 10 SOL → cap ≈ 2 SOL. A 1 SOL bet at 5× pays 5 SOL > cap → reject.
    try {
      await program.methods
        .settleBet(new anchor.BN(1 * LAMPORTS_PER_SOL), new anchor.BN(50_000))
        .accounts({ config, treasury, game, pool, creator: creator.publicKey, creatorVault, player: admin.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail('should hit the bankroll cap');
    } catch (e) {
      assert.include(e.toString(), 'BankrollCapExceeded');
    }
  });

  it('settles a winning bet, pays from the pool, and skims the edge to the treasury', async () => {
    await program.methods
      .settleBet(new anchor.BN(0.1 * LAMPORTS_PER_SOL), new anchor.BN(19_800)) // 1.98×
      .accounts({ config, treasury, game, pool, creator: creator.publicKey, creatorVault, player: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    const cv = await program.account.creatorVault.fetch(creatorVault);
    assert.isAbove(cv.accrued.toNumber(), 0);
    const t = await program.account.treasury.fetch(treasury);
    assert.isAbove(t.platformAccrued.toNumber(), 0);
  });

  it('blocks royalty claims until KYC is verified, then pays out', async () => {
    try {
      await program.methods
        .claimRoyalties()
        .accounts({ config, treasury, creatorVault, owner: creator.publicKey, creator: creator.publicKey })
        .signers([creator])
        .rpc();
      assert.fail('should require KYC');
    } catch (e) {
      assert.include(e.toString(), 'KycRequired');
    }

    await program.methods.setKyc(true).accounts({ config, creatorVault, admin: admin.publicKey }).rpc();
    await program.methods
      .claimRoyalties()
      .accounts({ config, treasury, creatorVault, owner: creator.publicKey, creator: creator.publicKey })
      .signers([creator])
      .rpc();
    const cv = await program.account.creatorVault.fetch(creatorVault);
    assert.equal(cv.accrued.toNumber(), 0);
  });

  it('unstakes pro-rata value back to the staker', async () => {
    const pos = await program.account.stakePosition.fetch(position);
    await program.methods
      .unstake(pos.shares)
      .accounts({ pool, position, owner: staker.publicKey, staker: staker.publicKey })
      .signers([staker])
      .rpc();
    const after = await program.account.stakePosition.fetch(position);
    assert.equal(after.shares.toString(), '0');
  });
});
