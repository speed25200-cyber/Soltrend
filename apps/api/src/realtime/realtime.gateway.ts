import { randomBytes } from 'crypto';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { crashPoint, commit, liveMultiplier } from './crash';

type Phase = 'betting' | 'running' | 'result';

interface Player {
  id: string;
  wallet: string;
  bet: number;
  cashedAt: number | null; // multiplier at cash-out, or null
  won: number; // payout
}

interface Round {
  id: number;
  phase: Phase;
  hash: string; // sha256(serverSeed) — the pre-round commitment
  serverSeed: string; // revealed only after bust
  roundSeed: string;
  nonce: number;
  crashPoint: number;
  startedAt: number; // ms epoch of running-phase start
  players: Map<string, Player>;
}

const BETTING_MS = 6000;
const RESULT_MS = 4000;
const TICK_MS = 100;
const EDGE = 0.02;

/**
 * Server-authoritative live Crash rooms. One shared round runs on the server; all
 * connected clients watch the SAME multiplier climb in real time and race to cash
 * out before the bust. Fairness is commit-reveal: the server broadcasts
 * sha256(serverSeed) before the round and reveals serverSeed after — so no one,
 * not even the house, can change the outcome mid-round, and anyone can verify it.
 *
 * State is in-memory (matches the rest of this reference API). Balances here are
 * play-money for the demo; a production deploy would debit/credit the vault.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/live' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private round!: Round;
  private roundCounter = 0;
  private history: { id: number; crashPoint: number }[] = [];

  afterInit() {
    this.startBetting();
  }

  handleConnection(client: Socket) {
    client.emit('snapshot', this.publicState(true));
    client.emit('history', this.history.slice(-24));
  }

  handleDisconnect(client: Socket) {
    this.round?.players.delete(client.id);
  }

  /* ----------------------------------------------------------- client actions */

  @SubscribeMessage('bet')
  onBet(@ConnectedSocket() client: Socket, @MessageBody() body: { amount?: number; wallet?: string }) {
    if (this.round.phase !== 'betting') return { ok: false, error: 'Betting is closed for this round' };
    const amount = Math.max(0.01, Math.min(100, Number(body?.amount) || 0.1));
    this.round.players.set(client.id, { id: client.id, wallet: (body?.wallet || 'anon').slice(0, 16), bet: amount, cashedAt: null, won: 0 });
    this.broadcast();
    return { ok: true, roundId: this.round.id, hash: this.round.hash };
  }

  @SubscribeMessage('cashout')
  onCashout(@ConnectedSocket() client: Socket) {
    const p = this.round.players.get(client.id);
    if (!p || this.round.phase !== 'running' || p.cashedAt !== null) return { ok: false };
    const m = liveMultiplier(Date.now() - this.round.startedAt);
    if (m >= this.round.crashPoint) return { ok: false, error: 'Too late — busted' };
    p.cashedAt = m;
    p.won = Math.round(p.bet * m * 1000) / 1000;
    this.broadcast();
    return { ok: true, multiplier: m, payout: p.won };
  }

  /* -------------------------------------------------------------- round engine */

  private startBetting() {
    const serverSeed = randomBytes(32).toString('hex');
    const roundSeed = randomBytes(8).toString('hex');
    this.roundCounter += 1;
    this.round = {
      id: this.roundCounter,
      phase: 'betting',
      serverSeed,
      hash: commit(serverSeed),
      roundSeed,
      nonce: this.roundCounter,
      crashPoint: crashPoint(serverSeed, roundSeed, this.roundCounter, EDGE),
      startedAt: 0,
      players: new Map(),
    };
    this.broadcast();
    setTimeout(() => this.startRunning(), BETTING_MS);
  }

  private startRunning() {
    this.round.phase = 'running';
    this.round.startedAt = Date.now();
    this.broadcast();
    const tick = setInterval(() => {
      const m = liveMultiplier(Date.now() - this.round.startedAt);
      if (m >= this.round.crashPoint) {
        clearInterval(tick);
        this.bust();
        return;
      }
      this.server.emit('tick', { roundId: this.round.id, multiplier: Math.min(m, this.round.crashPoint) });
    }, TICK_MS);
  }

  private bust() {
    this.round.phase = 'result';
    // anyone still in is a loss
    for (const p of this.round.players.values()) if (p.cashedAt === null) p.won = 0;
    this.history.push({ id: this.round.id, crashPoint: this.round.crashPoint });
    if (this.history.length > 60) this.history.shift();
    // reveal the seed — the round is now fully verifiable
    this.server.emit('bust', {
      roundId: this.round.id,
      crashPoint: this.round.crashPoint,
      serverSeed: this.round.serverSeed,
      roundSeed: this.round.roundSeed,
      nonce: this.round.nonce,
      players: this.playerList(),
    });
    setTimeout(() => this.startBetting(), RESULT_MS);
  }

  /* -------------------------------------------------------------------- emit */

  private playerList() {
    return [...this.round.players.values()].map((p) => ({ wallet: p.wallet, bet: p.bet, cashedAt: p.cashedAt, won: p.won }));
  }

  private publicState(includeSeedOnResult = false) {
    const r = this.round;
    return {
      roundId: r.id,
      phase: r.phase,
      hash: r.hash,
      crashPoint: r.phase === 'result' ? r.crashPoint : null,
      serverSeed: includeSeedOnResult && r.phase === 'result' ? r.serverSeed : null,
      multiplier: r.phase === 'running' ? liveMultiplier(Date.now() - r.startedAt) : 1,
      bettingEndsIn: r.phase === 'betting' ? BETTING_MS : 0,
      players: this.playerList(),
    };
  }

  private broadcast() {
    this.server.emit('state', this.publicState(true));
  }
}
