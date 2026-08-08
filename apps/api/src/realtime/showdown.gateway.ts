import { randomBytes } from 'crypto';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { commit, eliminationOrder, showdownPayout, RAKE } from './showdown';

interface Player {
  id: string;
  wallet: string;
  ship: string;
}

interface Show {
  id: number;
  phase: 'open' | 'showing' | 'result';
  hash: string;
  serverSeed: string;
  roundSeed: string;
  nonce: number;
  endsAt: number;
  players: Player[]; // join order — the reproducibility basis
  alive: Set<string>; // wallets still in
}

const BUY_IN = 0.1;
const OPEN_MS = 20000;
const STEP_MS = 1400;
const RESULT_MS = 6000;

/**
 * Game-show elimination rooms — a fair last-one-standing. Everyone buys in for
 * the same table stake; a provably-fair shuffle fixes the elimination order, and
 * the server reveals one elimination at a time for suspense until a single winner
 * takes the pot minus rake. Commit-reveal, server-authoritative, in-memory —
 * mirrors the Crash rooms. Play-money for the demo; production escrows buy-ins
 * through the vault.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/showdown' })
export class ShowdownGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private show!: Show;
  private counter = 0;
  private openTimer?: ReturnType<typeof setTimeout>;
  private stepTimer?: ReturnType<typeof setInterval>;
  private resultTimer?: ReturnType<typeof setTimeout>;

  afterInit() {
    this.startShow();
  }

  onModuleDestroy() {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.stepTimer) clearInterval(this.stepTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
  }

  handleConnection(client: Socket) {
    client.emit('state', this.publicState());
  }

  /* --------------------------------------------------------------- actions */

  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { wallet?: string; ship?: string }) {
    if (this.show.phase !== 'open') return { ok: false, error: 'The show has already started' };
    if (this.show.players.some((p) => p.id === client.id)) return { ok: false, error: 'Already in' };
    const player: Player = { id: client.id, wallet: (body?.wallet || 'anon').slice(0, 16), ship: (body?.ship || 'dart').slice(0, 12) };
    this.show.players.push(player);
    this.show.alive.add(player.wallet);
    this.broadcast();
    return { ok: true, showId: this.show.id, hash: this.show.hash, buyIn: BUY_IN };
  }

  /* ---------------------------------------------------------------- engine */

  private startShow() {
    const serverSeed = randomBytes(32).toString('hex');
    const roundSeed = randomBytes(8).toString('hex');
    this.counter += 1;
    this.show = {
      id: this.counter,
      phase: 'open',
      serverSeed,
      hash: commit(serverSeed),
      roundSeed,
      nonce: this.counter,
      endsAt: Date.now() + OPEN_MS,
      players: [],
      alive: new Set(),
    };
    this.broadcast();
    this.openTimer = setTimeout(() => this.runShow(), OPEN_MS);
  }

  private runShow() {
    // Need at least two contestants; otherwise reset and try again.
    if (this.show.players.length < 2) {
      this.startShow();
      return;
    }
    this.show.phase = 'showing';
    const order = eliminationOrder(this.show.serverSeed, this.show.roundSeed, this.show.nonce, this.show.players.length);
    this.broadcast();

    let step = 0; // eliminate order[0..n-2]; the last index wins
    const show = this.show;
    this.stepTimer = setInterval(() => {
      if (this.show !== show) {
        if (this.stepTimer) clearInterval(this.stepTimer);
        return;
      }
      if (step >= order.length - 1) {
        if (this.stepTimer) clearInterval(this.stepTimer);
        this.finish(order);
        return;
      }
      const out = show.players[order[step]];
      show.alive.delete(out.wallet);
      step += 1;
      this.server.emit('eliminated', { showId: show.id, wallet: out.wallet, remaining: show.alive.size });
    }, STEP_MS);
  }

  private finish(order: number[]) {
    this.show.phase = 'result';
    const winner = this.show.players[order[order.length - 1]];
    const payout = showdownPayout(BUY_IN, this.show.players.length);
    this.server.emit('winner', {
      showId: this.show.id,
      winnerWallet: winner.wallet,
      pot: Math.round(BUY_IN * this.show.players.length * 1000) / 1000,
      payout,
      // reveal — the whole elimination order is now verifiable
      serverSeed: this.show.serverSeed,
      roundSeed: this.show.roundSeed,
      nonce: this.show.nonce,
      hash: this.show.hash,
      order: order.map((i) => this.show.players[i].wallet),
    });
    this.resultTimer = setTimeout(() => this.startShow(), RESULT_MS);
  }

  /* -------------------------------------------------------------------- emit */

  private publicState() {
    const s = this.show;
    return {
      showId: s.id,
      phase: s.phase,
      hash: s.hash,
      buyIn: BUY_IN,
      rake: RAKE,
      pot: Math.round(BUY_IN * s.players.length * 1000) / 1000,
      endsInMs: s.phase === 'open' ? Math.max(0, s.endsAt - Date.now()) : 0,
      players: s.players.map((p) => ({ wallet: p.wallet, ship: p.ship, alive: s.alive.has(p.wallet) })),
    };
  }

  private broadcast() {
    this.server.emit('state', this.publicState());
  }
}
