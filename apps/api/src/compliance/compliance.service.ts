import { ForbiddenException, Injectable } from '@nestjs/common';

export interface RgLimits {
  maxBet?: number;
  dailyLossLimit?: number;
  selfExcludedUntil?: number;
}

/**
 * Compliance guard (§11). Non-bypassable: every settlement passes through
 * `assertCanBet`. Geo-blocking is a configurable deny-list checked by ISO
 * country code; responsible-gaming limits are enforced per session.
 * Blocking vs configurable is documented in docs/COMPLIANCE.md.
 */
@Injectable()
export class ComplianceService {
  /** Prohibited jurisdictions (ISO-3166 alpha-2). Configurable per licence. */
  private readonly blockedCountries = new Set(['US', 'GB', 'FR', 'NL', 'AU']);

  private readonly limits = new Map<string, RgLimits>();
  private readonly lossToday = new Map<string, { day: string; loss: number }>();

  geoAllowed(country?: string): boolean {
    if (!country) return true; // unknown → allow in this reference build; prod resolves via IP
    return !this.blockedCountries.has(country.toUpperCase());
  }

  assertGeo(country?: string): void {
    if (!this.geoAllowed(country)) {
      throw new ForbiddenException(`Access is restricted in your jurisdiction (${country}).`);
    }
  }

  setLimits(sessionId: string, patch: RgLimits): RgLimits {
    const cur = this.limits.get(sessionId) ?? {};
    const next = { ...cur, ...patch };
    this.limits.set(sessionId, next);
    return next;
  }

  getLimits(sessionId: string): RgLimits {
    return this.limits.get(sessionId) ?? {};
  }

  assertCanBet(sessionId: string, bet: number): void {
    const l = this.limits.get(sessionId) ?? {};
    if (l.selfExcludedUntil && l.selfExcludedUntil > Date.now()) {
      throw new ForbiddenException('Self-exclusion is active.');
    }
    if (l.maxBet && bet > l.maxBet) {
      throw new ForbiddenException(`Bet exceeds your max-bet limit of ${l.maxBet}.`);
    }
    if (l.dailyLossLimit) {
      const today = new Date().toISOString().slice(0, 10);
      const rec = this.lossToday.get(sessionId);
      const loss = rec && rec.day === today ? rec.loss : 0;
      if (loss >= l.dailyLossLimit) {
        throw new ForbiddenException('Daily loss limit reached — take a break.');
      }
    }
  }

  /** Track realised loss for the daily-loss limit. */
  recordNet(sessionId: string, net: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const rec = this.lossToday.get(sessionId);
    const base = rec && rec.day === today ? rec.loss : 0;
    this.lossToday.set(sessionId, { day: today, loss: Math.max(0, base - net) });
  }
}
