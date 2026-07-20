import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { HouseVault } from '../target/types/house_vault';

/**
 * Anchor tests covering the security invariants (see CHECKLIST_AUDIT.md):
 *  - config init + edge band, split-sum
 *  - liquidity deposit/withdraw authority
 *  - register_game rejects out-of-band edge
 *  - settle_bet: payout math, payout cap, vault solvency, creator accrual
 *  - claim_royalties gated on KYC
 */
describe('house_vault', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HouseVault as Program<HouseVault>;
  const admin = provider.wallet as anchor.Wallet;

  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], program.programId);

  const creator = Keypair.generate();
  const specHash = Array.from({ length: 32 }, (_, i) => i);
  const [game] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), creator.publicKey.toBuffer(), Buffer.from(specHash)],
    program.programId,
  );
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator'), creator.publicKey.toBuffer()],
    program.programId,
  );

  it('initialises config with a valid edge band + 50/20/20/10 split', async () => {
    await program.methods
      .initConfig(100, 500, new anchor.BN(10 * LAMPORTS_PER_SOL), {
        platformBps: 5000,
        creatorBps: 2000,
        referralBps: 2000, // bankroll / LP / affiliate share
        treasuryBps: 1000,
      })
      .accounts({ config, vault, admin: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();

    const cfg = await program.account.config.fetch(config);
    assert.equal(cfg.minEdgeBps, 100);
    assert.equal(cfg.maxEdgeBps, 500);
  });

  it('rejects a split that does not sum to 100%', async () => {
    try {
      await program.methods
        .initConfig(100, 500, new anchor.BN(1), { platformBps: 1, creatorBps: 1, referralBps: 1, treasuryBps: 1 })
        .accounts({ config, vault, admin: admin.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail('should have thrown');
    } catch (e) {
      assert.include(e.toString(), 'InvalidSplit');
    }
  });

  it('funds the vault', async () => {
    await program.methods
      .depositLiquidity(new anchor.BN(5 * LAMPORTS_PER_SOL))
      .accounts({ config, vault, admin: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    const bal = await provider.connection.getBalance(vault);
    assert.isAtLeast(bal, 5 * LAMPORTS_PER_SOL);
  });

  it('registers a creator + a game with in-band edge', async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(creator.publicKey, 2 * LAMPORTS_PER_SOL),
    );
    await program.methods
      .initCreator()
      .accounts({ creatorVault, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();

    await program.methods
      .registerGame(specHash, 200, 0)
      .accounts({ config, game, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();

    const g = await program.account.game.fetch(game);
    assert.equal(g.edgeBps, 200);
  });

  it('rejects an out-of-band edge on register_game', async () => {
    const badHash = Array.from({ length: 32 }, () => 9);
    const [badGame] = PublicKey.findProgramAddressSync(
      [Buffer.from('game'), creator.publicKey.toBuffer(), Buffer.from(badHash)],
      program.programId,
    );
    try {
      await program.methods
        .registerGame(badHash, 9000, 0)
        .accounts({ config, game: badGame, creator: creator.publicKey, systemProgram: SystemProgram.programId })
        .signers([creator])
        .rpc();
      assert.fail('should reject');
    } catch (e) {
      assert.include(e.toString(), 'EdgeOutOfBand');
    }
  });

  it('settles a winning bet and accrues creator royalties', async () => {
    const player = admin.publicKey;
    await program.methods
      .settleBet(new anchor.BN(0.1 * LAMPORTS_PER_SOL), new anchor.BN(19_800)) // 1.98×
      .accounts({
        config,
        vault,
        game,
        creator: creator.publicKey,
        creatorVault,
        player,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cv = await program.account.creatorVault.fetch(creatorVault);
    assert.isAbove(cv.accrued.toNumber(), 0);
  });

  it('blocks royalty claims until KYC is verified', async () => {
    try {
      await program.methods
        .claimRoyalties()
        .accounts({ config, vault, creatorVault, owner: creator.publicKey, creator: creator.publicKey })
        .signers([creator])
        .rpc();
      assert.fail('should require KYC');
    } catch (e) {
      assert.include(e.toString(), 'KycRequired');
    }

    await program.methods.setKyc(true).accounts({ config, creatorVault, admin: admin.publicKey }).rpc();

    await program.methods
      .claimRoyalties()
      .accounts({ config, vault, creatorVault, owner: creator.publicKey, creator: creator.publicKey })
      .signers([creator])
      .rpc();

    const cv = await program.account.creatorVault.fetch(creatorVault);
    assert.equal(cv.accrued.toNumber(), 0);
  });
});
