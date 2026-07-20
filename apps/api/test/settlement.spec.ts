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
