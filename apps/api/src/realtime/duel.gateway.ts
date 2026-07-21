import { randomBytes } from 'crypto';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { commit, resolveDuel, duelPayout, RAKE } from './duel';

interface Waiting {
  wallet: string;
  ante: number;
  ship: string;
}

interface Match {
  id: string;
  a: { id: string; wallet: string; ante: number; ship: string };
  b: { id: string; wallet: string; ante: number; ship: string };
  serverSeed: string;
  matchSeed: string;
  nonce: number;
  hash: string;
}

const REVEAL_MS = 3200;

/**
 * PvP duel matchmaking + settlement. Players queue with an ante; the server pairs
 * them, commits sha256(serverSeed), then reveals the seed and the outcome — a
 * provably-fair 1v1 where the winner takes the pot minus a small rake. Server-
 * authoritative and in-memory, mirroring the Crash rooms. Play-money for the
 * demo; a production deploy would escrow/settle the antes through the vault.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/duel' })
export class DuelGateway implements OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private queue = new Map<string, Waiting>(); // socketId -> waiting entry
  private matches = new Map<string, Match>(); // matchId -> match
  private socketMatch = new Map<string, string>(); // socketId -> matchId
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private counter = 0;

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  handleDisconnect(client: Socket) {
    this.queue.delete(client.id);
    // If they were mid-match, the opponent wins by forfeit.
    const matchId = this.socketMatch.get(client.id);
    if (matchId) {
      const m = this.matches.get(matchId);
      if (m) {
        const opp = m.a.id === client.id ? m.b : m.a;
        this.server.to(opp.id).emit('opponent-left', { matchId });
        this.cleanupMatch(m);
      }
    }
    this.broadcastQueue();
  }

  /* --------------------------------------------------------------- actions */

  @SubscribeMessage('queue')
  onQueue(@ConnectedSocket() client: Socket, @MessageBody() body: { wallet?: string; ante?: number; ship?: string }) {
    if (this.socketMatch.has(client.id)) return { ok: false, error: 'Already in a duel' };
    const ante = Math.max(0.01, Math.min(100, Number(body?.ante) || 0.1));
    const entry: Waiting = { wallet: (body?.wallet || 'anon').slice(0, 16), ante, ship: (body?.ship || 'dart').slice(0, 12) };
    // Pair with the first other waiting player.
    const opponentId = [...this.queue.keys()].find((id) => id !== client.id);
    if (opponentId) {
      const opp = this.queue.get(opponentId)!;
      this.queue.delete(opponentId);
      this.startMatch({ id: opponentId, ...opp }, { id: client.id, ...entry });
      return { ok: true, matched: true };
    }
    this.queue.set(client.id, entry);
    this.broadcastQueue();
    return { ok: true, matched: false, waiting: true };
  }

  @SubscribeMessage('leave-queue')
  onLeaveQueue(@ConnectedSocket() client: Socket) {
    this.queue.delete(client.id);
    this.broadcastQueue();
    return { ok: true };
  }

  /* ---------------------------------------------------------------- engine */

  private startMatch(
    a: { id: string; wallet: string; ante: number; ship: string },
    b: { id: string; wallet: string; ante: number; ship: string },
  ) {
    const serverSeed = randomBytes(32).toString('hex');
    const matchSeed = randomBytes(8).toString('hex');
    this.counter += 1;
    const match: Match = { id: `d${this.counter}`, a, b, serverSeed, matchSeed, nonce: this.counter, hash: commit(serverSeed) };
    this.matches.set(match.id, match);
    this.socketMatch.set(a.id, match.id);
    this.socketMatch.set(b.id, match.id);

    const meta = (self: typeof a, opp: typeof a) => ({
      matchId: match.id,
      hash: match.hash,
      you: { wallet: self.wallet, ante: self.ante, ship: self.ship },
      opponent: { wallet: opp.wallet, ante: opp.ante, ship: opp.ship },
      pot: Math.round((a.ante + b.ante) * 1000) / 1000,
      rake: RAKE,
      revealInMs: REVEAL_MS,
    });
    this.server.to(a.id).emit('matched', meta(a, b));
    this.server.to(b.id).emit('matched', meta(b, a));
    this.broadcastQueue();

    const t = setTimeout(() => this.resolve(match), REVEAL_MS);
    this.timers.add(t);
  }

  private resolve(match: Match) {
    if (!this.matches.has(match.id)) return; // torn down (forfeit / disconnect)
    const { winner, draw, threshold } = resolveDuel(match.serverSeed, match.matchSeed, match.nonce, match.a.ante, match.b.ante);
    const won = winner === 0 ? match.a : match.b;
    const payout = duelPayout(match.a.ante, match.b.ante);
    const result = {
      matchId: match.id,
      winnerWallet: won.wallet,
      payout,
      draw,
      threshold,
      // reveal — the duel is now fully verifiable
      serverSeed: match.serverSeed,
      matchSeed: match.matchSeed,
      nonce: match.nonce,
      hash: match.hash,
    };
    this.server.to(match.a.id).emit('duel-result', { ...result, youWon: winner === 0 });
    this.server.to(match.b.id).emit('duel-result', { ...result, youWon: winner === 1 });
    this.cleanupMatch(match);
  }

  private cleanupMatch(match: Match) {
    this.matches.delete(match.id);
    this.socketMatch.delete(match.a.id);
    this.socketMatch.delete(match.b.id);
  }

  private broadcastQueue() {
    this.server.emit('queue-size', { waiting: this.queue.size });
  }
}
