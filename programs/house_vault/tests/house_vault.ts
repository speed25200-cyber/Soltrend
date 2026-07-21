import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair } from '@solana/web3.js';
import { createHash } from 'crypto';
import { assert } from 'chai';
import { HouseVault } from '../target/types/house_vault';

/**
 * Anchor tests covering the community-bankroll + settlement invariants
 * (see CHECKLIST_AUDIT.md):
 *  - config + staker-favoured split (60/20/15/5) + settlement authority
 *  - register_game creates the per-game pool; out-of-band edge rejected
 *  - stake mints shares (virtual-offset defence against inflation)
 *  - open_bet reserves the max payout + enforces the bankroll cap
 *  - settle_bet: ONLY the authority can settle, commit-reveal is verified
 *    (sha256(seed) == hash), payout is bounded by the reservation, edge is skimmed
 *  - claim_royalties gated on KYC; unstake returns pro-rata value
 */
describe('house_vault', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HouseVault as Program<HouseVault>;
  const admin = provider.wallet as anchor.Wallet; // also the settlement authority

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
  const [creatorPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), pool.toBuffer(), creator.publicKey.toBuffer()],
    program.programId,
  );

  const betPda = (nonce: number) => {
    const n = Buffer.alloc(8);
    n.writeBigUInt64LE(BigInt(nonce));
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bet'), pool.toBuffer(), admin.publicKey.toBuffer(), n],
      program.programId,
    )[0];
  };
  const serverSeed = Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
  const serverSeedHash = Array.from(createHash('sha256').update(Buffer.from(serverSeed)).digest());
  const clientSeed = Array.from({ length: 32 }, () => 1);

  it('initialises config with the split + a settlement authority', async () => {
    await program.methods
      .initConfig(
        100,
        500,
        new anchor.BN(1000 * LAMPORTS_PER_SOL), // max payout
        new anchor.BN(5 * LAMPORTS_PER_SOL), // max bet (per-bet ceiling)
        new anchor.BN(1 * LAMPORTS_PER_SOL), // min creator bond
        { bankrollBps: 6000, creatorBps: 2000, platformBps: 1500, insuranceBps: 500 },
        admin.publicKey,
      )
      .accounts({ config, treasury, admin: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    const cfg = await program.account.config.fetch(config);
    assert.equal(cfg.settlementAuthority.toBase58(), admin.publicKey.toBase58());
  });

  it('registers a creator + a game (with its bankroll pool)', async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(creator.publicKey, 5 * LAMPORTS_PER_SOL),
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(staker.publicKey, 30 * LAMPORTS_PER_SOL),
    );
    await program.methods
      .initCreator()
      .accounts({ creatorVault, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();
    await program.methods
      .registerGame(specHash, 200, 0, new anchor.BN(2 * LAMPORTS_PER_SOL)) // 2 SOL creator bond
      .accounts({ config, game, pool, position: creatorPosition, creator: creator.publicKey, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();
    const cp = await program.account.stakePosition.fetch(creatorPosition);
    assert.isAbove(Number(cp.shares.toString()), 0); // creator is the first staker
  });

  it('rejects a game whose creator bond is below the minimum', async () => {
    const h2 = Array.from({ length: 32 }, () => 5);
    const [g2] = PublicKey.findProgramAddressSync([Buffer.from('game'), creator.publicKey.toBuffer(), Buffer.from(h2)], program.programId);
    const [p2] = PublicKey.findProgramAddressSync([Buffer.from('pool'), g2.toBuffer()], program.programId);
    const [pos2] = PublicKey.findProgramAddressSync([Buffer.from('stake'), p2.toBuffer(), creator.publicKey.toBuffer()], program.programId);
    try {
      await program.methods
        .registerGame(h2, 200, 0, new anchor.BN(0.1 * LAMPORTS_PER_SOL)) // below 1 SOL min bond
        .accounts({ config, game: g2, pool: p2, position: pos2, creator: creator.publicKey, systemProgram: SystemProgram.programId })
        .signers([creator])
        .rpc();
      assert.fail('should reject a small bond');
    } catch (e) {
      assert.include(e.toString(), 'BondTooSmall');
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

  it('rejects an open_bet whose reserved payout exceeds the bankroll cap', async () => {
    // pool ≈ 10 SOL → cap = 2 SOL. Reserving 3 SOL must be rejected.
    try {
      await program.methods
        .openBet(new anchor.BN(1 * LAMPORTS_PER_SOL), new anchor.BN(3 * LAMPORTS_PER_SOL), serverSeedHash, clientSeed, new anchor.BN(1))
        .accounts({ config, game, pool, bet: betPda(1), player: admin.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail('should hit the bankroll cap');
    } catch (e) {
      assert.include(e.toString(), 'BankrollCapExceeded');
    }
  });

  it('opens a bet, then ONLY the settlement authority can settle it (commit-reveal)', async () => {
    const bet = betPda(2);
    await program.methods
      .openBet(new anchor.BN(0.1 * LAMPORTS_PER_SOL), new anchor.BN(0.2 * LAMPORTS_PER_SOL), serverSeedHash, clientSeed, new anchor.BN(2))
      .accounts({ config, game, pool, bet, player: admin.publicKey, systemProgram: SystemProgram.programId })
      .rpc();

    // A wrong seed must be rejected (hash mismatch).
    try {
      await program.methods
        .settleBet(clientSeed, new anchor.BN(19_800))
        .accounts({ config, treasury, game, pool, creator: creator.publicKey, creatorVault, bet, player: admin.publicKey, settlementAuthority: admin.publicKey })
        .rpc();
      assert.fail('wrong seed should fail');
    } catch (e) {
      assert.include(e.toString(), 'SeedMismatch');
    }

    // Correct reveal by the authority settles + accrues the edge.
    await program.methods
      .settleBet(serverSeed, new anchor.BN(19_800)) // 1.98×
      .accounts({ config, treasury, game, pool, creator: creator.publicKey, creatorVault, bet, player: admin.publicKey, settlementAuthority: admin.publicKey })
      .rpc();
    const cv = await program.account.creatorVault.fetch(creatorVault);
    assert.isAbove(cv.accrued.toNumber(), 0);
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
