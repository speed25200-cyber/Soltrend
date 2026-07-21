import { minesLayout } from '@soltrend/shared';
import { SessionStore } from '../src/common/session.store';
import { MetricsService } from '../src/metrics/metrics.service';
import { ComplianceService } from '../src/compliance/compliance.service';
import { GamesService } from '../src/games/games.service';
import { FairService } from '../src/fair/fair.service';

function build() {
  const store = new SessionStore();
  const metrics = new MetricsService();
  const compliance = new ComplianceService();
  const games = new GamesService(store, metrics, compliance);
  const fair = new FairService(store);
  return { store, metrics, compliance, games, fair };
}

describe('provably-fair settlement', () => {
  it('reserves a monotonic nonce and only ever exposes the server-seed HASH', () => {
    const { store } = build();
    const cur = store.getOrCreate('s1', 'mine');
    expect(cur.serverSeedHash).toHaveLength(64);
    const a = store.reserve('s1');
    const b = store.reserve('s1');
    expect(a.nonce).toBe(1);
    expect(b.nonce).toBe(2);
    expect((a as any).serverSeed).toBeDefined(); // internal snapshot has it, never returned by fair.current
  });

  it('settle → rotate(reveal) → verify reproduces the exact outcome', () => {
    const { games, store, fair } = build();
    const bet = 0.5;
    const settled = games.settle({
      sessionId: 's2',
      player: 'wallet1',
      gameId: 'dice',
      bet,
      params: { target: 42, over: true },
    });

    const { revealed } = fair.rotate('s2');
    expect(revealed.hashCheck).toBe(true);

    const v = fair.verify({
      serverSeed: revealed.serverSeed,
      clientSeed: settled.clientSeed,
      nonce: settled.nonce,
      template: 'dice',
      bet,
      params: { target: 42, over: true },
      edge: 0.01,
      expectedHash: settled.serverSeedHash,
    });

    expect(v.hashMatches).toBe(true);
    expect(v.outcome.multiplier).toBe(settled.multiplier);
    expect((v.outcome.detail as any).roll).toBe((settled.detail as any).roll);
    expect(v.outcome.payout).toBe(settled.payout);
  });

  it('dice realises ~1% house edge over many bets', () => {
    const { games } = build();
    let staked = 0;
    let paid = 0;
    for (let i = 0; i < 30000; i++) {
      const r = games.settle({
        sessionId: 'edge',
        player: 'p',
        gameId: 'dice',
        bet: 1,
        params: { target: 50, over: true },
      });
      staked += 1;
      paid += r.payout;
    }
    const edge = ((staked - paid) / staked) * 100;
    expect(edge).toBeGreaterThan(0.3);
    expect(edge).toBeLessThan(1.8);
  });

  it('mines: hitting a bomb loses, a safe path pays', () => {
    const { games, store } = build();

    // Safe path: derive the next layout, pick tiles that are NOT bombs.
    let s = store.peek('mineok');
    let seeds = { serverSeed: s.serverSeed, serverSeedHash: s.serverSeedHash, clientSeed: s.clientSeed, nonce: s.nonce + 1 };
    let layout = minesLayout(25, 3, seeds);
    const safe = Array.from({ length: 25 }, (_, i) => i).filter((i) => !layout.has(i)).slice(0, 3);
    const win = games.settle({ sessionId: 'mineok', player: 'p', gameId: 'mines', bet: 1, params: { tiles: safe } });
    expect(win.win).toBe(true);
    expect(win.multiplier).toBeGreaterThan(1);

    // Bomb path: pick a known bomb tile for the next nonce.
    s = store.peek('mineok');
    seeds = { serverSeed: s.serverSeed, serverSeedHash: s.serverSeedHash, clientSeed: s.clientSeed, nonce: s.nonce + 1 };
    layout = minesLayout(25, 3, seeds);
    const bomb = [...layout][0];
    const loss = games.settle({ sessionId: 'mineok', player: 'p', gameId: 'mines', bet: 1, params: { tiles: [bomb] } });
    expect(loss.win).toBe(false);
    expect(loss.payout).toBe(0);
  });

  it('rejects an invalid GameSpec and accepts a valid one', () => {
    const { games } = build();
    expect(() =>
      games.register(
        { template: 'dice', name: 'Rug', edge: 0.5, params: {}, theme: { accent: 'violet', icon: 'dice' } },
        'creatorX',
      ),
    ).toThrow();

    const g = games.register(
      { template: 'limbo', name: 'Fair Moon', edge: 0.02, params: {}, theme: { accent: 'cyan', icon: 'trend' } },
      'creatorX',
    );
    expect(g.id).toMatch(/^ugc-/);
    expect(g.edge).toBe(0.02);
  });

  it('compliance blocks bets over a max-bet limit', () => {
    const { games, compliance } = build();
    compliance.setLimits('capped', { maxBet: 0.1 });
    expect(() =>
      games.settle({ sessionId: 'capped', player: 'p', gameId: 'dice', bet: 1, params: {} }),
    ).toThrow();
  });
});

describe('PvP duel resolution', () => {
  it('is reproducible and fair with equal antes (threshold 0.5)', async () => {
    const { resolveDuel, duelPayout, commit } = await import('../src/realtime/duel');
    const seed = 'a'.repeat(64);
    const r1 = resolveDuel(seed, 'match1', 7, 0.1, 0.1);
    const r2 = resolveDuel(seed, 'match1', 7, 0.1, 0.1);
    expect(r1).toEqual(r2); // deterministic from (seed, matchSeed, nonce)
    expect(r1.threshold).toBeCloseTo(0.5);
    expect([0, 1]).toContain(r1.winner);
    // winner takes the pot minus the 2% rake
    expect(duelPayout(0.1, 0.1)).toBeCloseTo(0.2 * 0.98);
    expect(commit(seed)).toHaveLength(64);
  });

  it('weights the win threshold by ante so EV stays neutral before rake', async () => {
    const { resolveDuel } = await import('../src/realtime/duel');
    const r = resolveDuel('b'.repeat(64), 'm', 3, 0.3, 0.1); // 3:1 stake
    expect(r.threshold).toBeCloseTo(0.75); // bigger ante → bigger win chance
  });

  it('is close to a fair coin over many equal-ante draws', async () => {
    const { resolveDuel } = await import('../src/realtime/duel');
    let winsA = 0;
    const N = 4000;
    for (let i = 1; i <= N; i++) if (resolveDuel('c'.repeat(64), 'bulk', i, 1, 1).winner === 0) winsA++;
    expect(winsA / N).toBeGreaterThan(0.45);
    expect(winsA / N).toBeLessThan(0.55);
  });
});

describe('shared jackpot draw', () => {
  it('picks a winner reproducibly and weights by stake', async () => {
    const { drawWinner, jackpotPayout } = await import('../src/realtime/jackpot');
    const entries = [
      { wallet: 'a', amount: 1 },
      { wallet: 'b', amount: 3 },
    ];
    const seed = 'e'.repeat(64);
    const r1 = drawWinner(seed, 'r', 2, entries);
    const r2 = drawWinner(seed, 'r', 2, entries);
    expect(r1).toEqual(r2);
    expect(r1.pot).toBe(4);
    expect([0, 1]).toContain(r1.winner);
    expect(jackpotPayout(4)).toBeCloseTo(4 * 0.97);
  });

  it('win frequency tracks pot share (b has ~75%)', async () => {
    const { drawWinner } = await import('../src/realtime/jackpot');
    const entries = [
      { wallet: 'a', amount: 1 },
      { wallet: 'b', amount: 3 },
    ];
    let bWins = 0;
    const N = 4000;
    for (let i = 1; i <= N; i++) if (drawWinner('f'.repeat(64), 'bulk', i, entries).winner === 1) bWins++;
    expect(bWins / N).toBeGreaterThan(0.7);
    expect(bWins / N).toBeLessThan(0.8);
  });

  it('handles an empty pot without crashing', async () => {
    const { drawWinner } = await import('../src/realtime/jackpot');
    const r = drawWinner('a'.repeat(64), 'r', 1, []);
    expect(r.winner).toBe(-1);
    expect(r.pot).toBe(0);
  });
});

describe('game-show elimination', () => {
  it('produces a reproducible full elimination order (a permutation)', async () => {
    const { eliminationOrder, showdownPayout } = await import('../src/realtime/showdown');
    const seed = 'd'.repeat(64);
    const o1 = eliminationOrder(seed, 'r', 5, 6);
    const o2 = eliminationOrder(seed, 'r', 5, 6);
    expect(o1).toEqual(o2);
    expect([...o1].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]); // every seat exactly once
    // pot = buyIn * players, minus 4% rake
    expect(showdownPayout(0.1, 6)).toBeCloseTo(0.6 * 0.96);
  });

  it('gives every seat an equal ~1/N chance of winning (last in order)', async () => {
    const { eliminationOrder } = await import('../src/realtime/showdown');
    const N = 5;
    const wins = new Array(N).fill(0);
    const T = 5000;
    for (let i = 1; i <= T; i++) {
      const order = eliminationOrder('g'.repeat(64), 'bulk', i, N);
      wins[order[order.length - 1]]++; // winner is the last seat standing
    }
    for (const w of wins) {
      expect(w / T).toBeGreaterThan(0.16); // ~0.20 each
      expect(w / T).toBeLessThan(0.24);
    }
  });
});

describe('co-op heist', () => {
  it('splits antes into stake + crew vault and pays the bonus only when all grab', async () => {
    const { stakeOf, crewVault, heistPayout, VAULT_CUT } = await import('../src/realtime/heist');
    expect(VAULT_CUT).toBe(0.05);
    expect(stakeOf(1)).toBeCloseTo(0.95);
    const antes = [1, 1, 2];
    expect(crewVault(antes)).toBeCloseTo(4 * 0.05); // 0.2 pooled
    const vault = crewVault(antes);
    // all grabbed → survivor gets stake*m plus an equal vault share
    expect(heistPayout(1, 2, true, vault, 3)).toBeCloseTo(0.95 * 2 + vault / 3);
    // not everyone grabbed → no vault bonus
    expect(heistPayout(1, 2, false, vault, 2)).toBeCloseTo(0.95 * 2);
    // busted (lockedM 0) → nothing
    expect(heistPayout(1, 0, true, vault, 3)).toBe(0);
  });

  it('the crew vault is player redistribution, never house exposure', async () => {
    const { stakeOf, crewVault } = await import('../src/realtime/heist');
    const antes = [0.1, 0.2, 0.3, 0.4];
    const totalStake = antes.reduce((s, a) => s + stakeOf(a), 0);
    const vault = crewVault(antes);
    // stakes + vault reconstruct the total antes exactly (nothing minted)
    expect(totalStake + vault).toBeCloseTo(antes.reduce((s, a) => s + a, 0), 5);
  });
});
