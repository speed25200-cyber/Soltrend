import { Injectable } from '@nestjs/common';

export interface GameStat {
  gameId: string;
  name: string;
  template: string;
  creator: string;
  volume: number;
  plays: number;
  players: Set<string>;
  netToPlayers: number;
}

export interface LeaderboardRow {
  gameId: string;
  name: string;
  template: string;
  creator: string;
  volume: number;
  plays: number;
  uniquePlayers: number;
}

/**
 * In-memory metrics + leaderboards (§10). Indexes every settled bet by game and
 * creator so the trending feed and rankings reflect real wagered volume. Swap
 * for a Postgres/materialised-view indexer in production.
 */
@Injectable()
export class MetricsService {
  private readonly games = new Map<string, GameStat>();

  record(params: {
    gameId: string;
    name: string;
    template: string;
    creator: string;
    player: string;
    bet: number;
    payout: number;
  }): void {
    let g = this.games.get(params.gameId);
    if (!g) {
      g = {
        gameId: params.gameId,
        name: params.name,
        template: params.template,
        creator: params.creator,
        volume: 0,
        plays: 0,
        players: new Set(),
        netToPlayers: 0,
      };
      this.games.set(params.gameId, g);
    }
    g.volume += params.bet;
    g.plays += 1;
    g.players.add(params.player);
    g.netToPlayers += params.payout - params.bet;
  }

  private row(g: GameStat): LeaderboardRow {
    return {
      gameId: g.gameId,
      name: g.name,
      template: g.template,
      creator: g.creator,
      volume: round(g.volume),
      plays: g.plays,
      uniquePlayers: g.players.size,
    };
  }

  topGames(limit = 20): LeaderboardRow[] {
    return [...this.games.values()]
      .map((g) => this.row(g))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }

  topCreators(limit = 20): { creator: string; volume: number; games: number; plays: number }[] {
    const map = new Map<string, { creator: string; volume: number; games: number; plays: number }>();
    for (const g of this.games.values()) {
      const e = map.get(g.creator) ?? { creator: g.creator, volume: 0, games: 0, plays: 0 };
      e.volume += g.volume;
      e.games += 1;
      e.plays += g.plays;
      map.set(g.creator, e);
    }
    return [...map.values()]
      .map((c) => ({ ...c, volume: round(c.volume) }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
