import { describe, expect, it } from 'vitest';
import { sanitize } from '@/lib/store';

/**
 * Persisted state is untrusted input.
 *
 * It comes back from a browser that may have been running an older build, run
 * out of quota mid-write, or simply been edited by hand. Trusting it means one
 * bad record white-screens the app on every load, with no recovery available to
 * the user but clearing site data. Every field is therefore validated
 * independently: a corrupt history costs the history, not the session.
 */
describe('rehydrating a saved session', () => {
  it('survives anything that is not an object', () => {
    for (const junk of [undefined, null, 0, '', 'nope', [], true, Number.NaN]) {
      expect(() => sanitize(junk)).not.toThrow();
      expect(typeof sanitize(junk)).toBe('object');
    }
  });

  it('drops a field rather than restoring it broken', () => {
    const out = sanitize({ balance: 'lots', history: 'not an array', ugc: { not: 'an array' } });
    expect(out.balance).toBe(0);
    expect(out.history).toEqual([]);
    expect(out.ugc).toEqual([]);
  });

  it('refuses an impossible balance', () => {
    expect(sanitize({ balance: -50 }).balance).toBe(0);
    expect(sanitize({ balance: Infinity }).balance).toBe(0);
    expect(sanitize({ balance: 1e30 }).balance).toBe(1e9);
    expect(sanitize({ balance: 12.5 }).balance).toBe(12.5);
  });

  it('replaces a seed pair it cannot verify', () => {
    const good = {
      serverSeed: 'a'.repeat(64),
      serverSeedHash: 'b'.repeat(64),
      clientSeed: 'player',
      nonce: 12,
    };
    expect(sanitize({ seeds: good }).seeds).toEqual(good);

    // A seed pair that is not a committed 32-byte hex pair cannot be used to
    // replay past bets, so it is discarded and a fresh one is generated.
    for (const bad of [
      { ...good, serverSeed: 'short' },
      { ...good, serverSeedHash: 42 },
      { ...good, clientSeed: null },
      'not an object',
      undefined,
    ]) {
      expect(sanitize({ seeds: bad }).seeds).toBeUndefined();
    }
  });

  it('never restores a negative or fractional nonce', () => {
    const seeds = { serverSeed: 'a'.repeat(64), serverSeedHash: 'b'.repeat(64), clientSeed: 'c', nonce: -7.5 };
    expect(sanitize({ seeds }).seeds?.nonce).toBe(0);
  });

  it('keeps only bet records that are actually bet records', () => {
    const out = sanitize({
      history: [
        { id: 'a', bet: 1 },
        { id: 'b', bet: 'x' }, // unparseable
        null,
        { bet: 2 }, // no id
        { id: 'c', bet: 0.5 },
      ],
    });
    expect(out.history?.map((h) => h.id)).toEqual(['a', 'c']);
  });

  it('caps history so a long-lived session cannot fill storage', () => {
    const many = Array.from({ length: 5_000 }, (_, i) => ({ id: `h${i}`, bet: 1 }));
    expect(sanitize({ history: many }).history!.length).toBeLessThanOrEqual(500);
  });

  it('keeps a self-exclusion even when the record is unreadable', () => {
    // Responsible gaming is a commitment, not a preference. A corrupt value must
    // fail closed — dropping it would silently let an excluded player back in.
    const out = sanitize({ rg: { selfExcludedUntil: 'corrupted' } });
    expect(out.rg!.selfExcludedUntil).toBeGreaterThan(Date.now());
    // …but an explicit null is a player who never excluded themselves.
    expect(sanitize({ rg: { selfExcludedUntil: null } }).rg!.selfExcludedUntil).toBeNull();
  });

  it('restores responsible-gaming limits within sane bounds', () => {
    const out = sanitize({ rg: { maxBet: -5, dailyLossLimit: 1e30, sessionMinutes: 99_999 } });
    expect(out.rg!.maxBet).toBe(0);
    expect(out.rg!.dailyLossLimit).toBe(1e9);
    expect(out.rg!.sessionMinutes).toBe(10_080); // one week, the ceiling
  });

  it('keeps only community games that could actually be rendered', () => {
    const out = sanitize({
      ugc: [
        { id: 'g1', name: 'Good', template: 'dice' },
        { id: 'g2', name: 'No template' },
        { name: 'No id', template: 'dice' },
        'nonsense',
      ],
    });
    expect(out.ugc?.map((g) => g.id)).toEqual(['g1']);
  });

  it('leaves untouched fields absent so the store default applies', () => {
    const out = sanitize({ balance: 1 });
    expect('history' in out).toBe(false);
    expect('progress' in out).toBe(false);
    expect('seeds' in out).toBe(false);
  });

  it('ignores an empty progress object rather than restoring a hollow one', () => {
    expect('progress' in sanitize({ progress: {} })).toBe(false);
    expect('progress' in sanitize({ progress: { xp: 10 } })).toBe(true);
  });
});
