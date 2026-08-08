import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { validateSpec, randomHex, type Template, type GameSpec } from '@soltrend/shared';
import { SessionStore } from '../common/session.store';
import { MetricsService } from '../metrics/metrics.service';
import { ComplianceService } from '../compliance/compliance.service';
import { computeOutcome, type Outcome } from './outcome';

export interface RegisteredGame {
  id: string;
  name: string;
  template: Template;
  creator: string;
  edge: number;
  params: Record<string, any>;
  ugc: boolean;
}

export interface SettleResult extends Outcome {
  gameId: string;
  game: string;
  bet: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
}

@Injectable()
export class GamesService {
  private readonly registry = new Map<string, RegisteredGame>();

  constructor(
    private readonly store: SessionStore,
    private readonly metrics: MetricsService,
    private readonly compliance: ComplianceService,
  ) {
    // Seed the built-in Originals (the house games).
    const house: RegisteredGame[] = [
      { id: 'dice', name: 'Dice', template: 'dice', creator: 'house', edge: 0.01, params: {}, ugc: false },
      { id: 'limbo', name: 'Limbo', template: 'limbo', creator: 'house', edge: 0.01, params: {}, ugc: false },
      { id: 'coinflip', name: 'Coinflip', template: 'coinflip', creator: 'house', edge: 0.01, params: {}, ugc: false },
      { id: 'wheel', name: 'Wheel', template: 'wheel', creator: 'house', edge: 0.02, params: { risk: 'medium' }, ugc: false },
      { id: 'plinko', name: 'Plinko', template: 'plinko', creator: 'house', edge: 0.01, params: { risk: 'medium', rows: 12 }, ugc: false },
      { id: 'mines', name: 'Mines', template: 'mines', creator: 'house', edge: 0.01, params: { grid: 25, bombs: 3 }, ugc: false },
    ];
    house.forEach((g) => this.registry.set(g.id, g));
  }

  list(): RegisteredGame[] {
    return [...this.registry.values()];
  }

  get(id: string): RegisteredGame {
    const g = this.registry.get(id);
    if (!g) throw new NotFoundException(`Unknown game: ${id}`);
    return g;
  }

  /** Publish a UGC game after validating its GameSpec (the safety gate, §7). */
  register(spec: GameSpec, creator: string): RegisteredGame {
    const v = validateSpec(spec);
    if (!v.ok) throw new BadRequestException({ message: 'Invalid GameSpec', errors: v.errors });
    const game: RegisteredGame = {
      id: 'ugc-' + randomHex(4),
      name: spec.name.trim(),
      template: spec.template,
      creator,
      edge: spec.edge,
      params: spec.params,
      ugc: true,
    };
    this.registry.set(game.id, game);
    return game;
  }

  /** The single settlement path — compliance-guarded, provably-fair, indexed. */
  settle(input: {
    sessionId: string;
    player: string;
    gameId: string;
    bet: number;
    country?: string;
    params?: Record<string, any>;
  }): SettleResult {
    if (!(input.bet > 0)) throw new BadRequestException('Bet must be positive.');
    const game = this.get(input.gameId);

    this.compliance.assertGeo(input.country);
    this.compliance.assertCanBet(input.sessionId, input.bet);

    const seeds = this.store.reserve(input.sessionId);
    const params = { ...game.params, ...(input.params ?? {}) };
    const outcome = computeOutcome(game.template, params, game.edge, input.bet, seeds);

    this.metrics.record({
      gameId: game.id,
      name: game.name,
      template: game.template,
      creator: game.creator,
      player: input.player,
      bet: input.bet,
      payout: outcome.payout,
    });
    this.compliance.recordNet(input.sessionId, outcome.payout - input.bet);

    return {
      ...outcome,
      gameId: game.id,
      game: game.name,
      bet: input.bet,
      nonce: seeds.nonce,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
    };
  }
}
