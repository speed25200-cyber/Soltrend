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
import { commit, drawWinner, jackpotPayout, RAKE, type Entry } from './jackpot';

interface Round {
  id: number;
  phase: 'open' | 'result';
  hash: string;
  serverSeed: string;
  roundSeed: string;
  nonce: number;
  endsAt: number;
  entries: Map<string, Entry & { ship: string }>; // socketId -> entry
}

const OPEN_MS = 25000;
const RESULT_MS = 5000;

/**
 * Shared-jackpot rooms. Everyone enters one growing community pot; when the timer
 * ends a provably-fair weighted draw picks a winner who takes the pot minus rake.
 * Server-authoritative, commit-reveal, in-memory — mirrors the Crash rooms. Play-
 * money for the demo; production would escrow entries through the vault.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/jackpot' })
export class JackpotGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private round!: Round;
  private counter = 0;
  private openTimer?: ReturnType<typeof setTimeout>;
  private resultTimer?: ReturnType<typeof setTimeout>;

  afterInit() {
    this.startRound();
  }

  onModuleDestroy() {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
  }

  handleConnection(client: Socket) {
    client.emit('state', this.publicState());
  }

  /* --------------------------------------------------------------- actions */

  @SubscribeMessage('enter')
  onEnter(@ConnectedSocket() client: Socket, @MessageBody() body: { amount?: number; wallet?: string; ship?: string }) {
    if (this.round.phase !== 'open') return { ok: false, error: 'This round has closed' };
    const amount = Math.max(0.01, Math.min(100, Number(body?.amount) || 0.1));
    const prev = this.round.entries.get(client.id);
    this.round.entries.set(client.id, {
      wallet: (body?.wallet || 'anon').slice(0, 16),
      amount: Math.round(((prev?.amount ?? 0) + amount) * 1000) / 1000, // stacking entries add up
      ship: (body?.ship || 'dart').slice(0, 12),
    });
    this.broadcast();
    return { ok: true, roundId: this.round.id, hash: this.round.hash };
  }

  /* ---------------------------------------------------------------- engine */

  private startRound() {
    const serverSeed = randomBytes(32).toString('hex');
    const roundSeed = randomBytes(8).toString('hex');
    this.counter += 1;
    this.round = {
      id: this.counter,
      phase: 'open',
      serverSeed,
      hash: commit(serverSeed),
      roundSeed,
      nonce: this.counter,
      endsAt: Date.now() + OPEN_MS,
      entries: new Map(),
    };
    this.broadcast();
    this.openTimer = setTimeout(() => this.settle(), OPEN_MS);
  }

  private settle() {
    this.round.phase = 'result';
    const entries = [...this.round.entries.values()].map((e) => ({ wallet: e.wallet, amount: e.amount }));
    const { winner, draw, pot } = drawWinner(this.round.serverSeed, this.round.roundSeed, this.round.nonce, entries);
    const won = winner >= 0 ? entries[winner] : null;
    this.server.emit('result', {
      roundId: this.round.id,
      winnerWallet: won?.wallet ?? null,
      pot,
      payout: won ? jackpotPayout(pot) : 0,
      draw,
      // reveal — the draw is now fully verifiable
      serverSeed: this.round.serverSeed,
      roundSeed: this.round.roundSeed,
      nonce: this.round.nonce,
      hash: this.round.hash,
      entries: this.entryList(),
    });
    this.resultTimer = setTimeout(() => this.startRound(), RESULT_MS);
  }

  /* -------------------------------------------------------------------- emit */

  private entryList() {
    const pot = [...this.round.entries.values()].reduce((s, e) => s + e.amount, 0);
    return [...this.round.entries.values()].map((e) => ({
      wallet: e.wallet,
      amount: e.amount,
      ship: e.ship,
      chance: pot > 0 ? Math.round((e.amount / pot) * 1000) / 10 : 0, // % win chance
    }));
  }

  private publicState() {
    const r = this.round;
    const pot = [...r.entries.values()].reduce((s, e) => s + e.amount, 0);
    return {
      roundId: r.id,
      phase: r.phase,
      hash: r.hash,
      pot: Math.round(pot * 1000) / 1000,
      rake: RAKE,
      endsInMs: r.phase === 'open' ? Math.max(0, r.endsAt - Date.now()) : 0,
      entries: this.entryList(),
    };
  }

  private broadcast() {
    this.server.emit('state', this.publicState());
  }
}
