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
import { commit, heistBust, liveMultiplier, crewVault, heistPayout, VAULT_CUT } from './heist';

interface Member {
  id: string;
  wallet: string;
  ante: number;
  ship: string;
  lockedM: number | null; // grabbed multiplier, or null (still in / busted)
  won: number;
}

interface Run {
  id: number;
  phase: 'gather' | 'running' | 'result';
  hash: string;
  serverSeed: string;
  roundSeed: string;
  nonce: number;
  bust: number;
  startedAt: number;
  gatherEndsAt: number;
  crew: Map<string, Member>;
}

const GATHER_MS = 7000;
const RESULT_MS = 5000;
const TICK_MS = 100;
const EDGE = 0.02;

/**
 * Co-op Heist rooms. The crew rides one shared, server-authoritative multiplier;
 * each member grabs their loot before the bust, and a crew vault (a slice of every
 * ante) pays a shared bonus only if EVERYONE grabs in time. Commit-reveal fair,
 * in-memory — mirrors the Crash rooms. Play-money for the demo.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/heist' })
export class HeistGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private run!: Run;
  private counter = 0;
  private gatherTimer?: ReturnType<typeof setTimeout>;
  private runInterval?: ReturnType<typeof setInterval>;
  private resultTimer?: ReturnType<typeof setTimeout>;

  afterInit() {
    this.startGather();
  }

  onModuleDestroy() {
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
    if (this.runInterval) clearInterval(this.runInterval);
    if (this.resultTimer) clearTimeout(this.resultTimer);
  }

  handleConnection(client: Socket) {
    client.emit('state', this.publicState());
  }

  /* --------------------------------------------------------------- actions */

  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { ante?: number; wallet?: string; ship?: string }) {
    if (this.run.phase !== 'gather') return { ok: false, error: 'The crew has already set off' };
    const ante = Math.max(0.01, Math.min(100, Number(body?.ante) || 0.1));
    this.run.crew.set(client.id, { id: client.id, wallet: (body?.wallet || 'anon').slice(0, 16), ante, ship: (body?.ship || 'dart').slice(0, 12), lockedM: null, won: 0 });
    this.broadcast();
    return { ok: true, runId: this.run.id, hash: this.run.hash };
  }

  @SubscribeMessage('grab')
  onGrab(@ConnectedSocket() client: Socket) {
    const m = this.run.crew.get(client.id);
    if (!m || this.run.phase !== 'running' || m.lockedM !== null) return { ok: false };
    const cur = liveMultiplier(Date.now() - this.run.startedAt);
    if (cur >= this.run.bust) return { ok: false, error: 'Too late — busted' };
    m.lockedM = cur;
    this.broadcast();
    return { ok: true, multiplier: cur };
  }

  /* ---------------------------------------------------------------- engine */

  private startGather() {
    const serverSeed = randomBytes(32).toString('hex');
    const roundSeed = randomBytes(8).toString('hex');
    this.counter += 1;
    this.run = {
      id: this.counter,
      phase: 'gather',
      serverSeed,
      hash: commit(serverSeed),
      roundSeed,
      nonce: this.counter,
      bust: heistBust(serverSeed, roundSeed, this.counter, EDGE),
      startedAt: 0,
      gatherEndsAt: Date.now() + GATHER_MS,
      crew: new Map(),
    };
    this.broadcast();
    this.gatherTimer = setTimeout(() => this.startRunning(), GATHER_MS);
  }

  private startRunning() {
    if (this.run.crew.size === 0) {
      this.startGather();
      return;
    }
    this.run.phase = 'running';
    this.run.startedAt = Date.now();
    this.broadcast();
    const r = this.run;
    this.runInterval = setInterval(() => {
      if (this.run !== r || r.phase !== 'running') {
        if (this.runInterval) clearInterval(this.runInterval);
        return;
      }
      const m = liveMultiplier(Date.now() - r.startedAt);
      // End early once the multiplier busts OR everyone has already grabbed.
      const allGrabbed = [...r.crew.values()].every((x) => x.lockedM !== null);
      if (m >= r.bust || allGrabbed) {
        clearInterval(this.runInterval);
        this.settle();
        return;
      }
      this.server.emit('tick', { runId: r.id, multiplier: Math.min(m, r.bust) });
    }, TICK_MS);
  }

  private settle() {
    this.run.phase = 'result';
    const crew = [...this.run.crew.values()];
    const survivors = crew.filter((m) => m.lockedM !== null);
    const allGrabbed = survivors.length === crew.length && crew.length > 0;
    const vault = crewVault(crew.map((m) => m.ante));
    for (const m of crew) m.won = heistPayout(m.ante, m.lockedM ?? 0, allGrabbed, vault, survivors.length);
    this.server.emit('result', {
      runId: this.run.id,
      bust: this.run.bust,
      allGrabbed,
      vault,
      // reveal — the run is now fully verifiable
      serverSeed: this.run.serverSeed,
      roundSeed: this.run.roundSeed,
      nonce: this.run.nonce,
      hash: this.run.hash,
      crew: this.crewList(),
    });
    this.resultTimer = setTimeout(() => this.startGather(), RESULT_MS);
  }

  /* -------------------------------------------------------------------- emit */

  private crewList() {
    return [...this.run.crew.values()].map((m) => ({ wallet: m.wallet, ante: m.ante, ship: m.ship, lockedM: m.lockedM, won: m.won }));
  }

  private publicState() {
    const r = this.run;
    return {
      runId: r.id,
      phase: r.phase,
      hash: r.hash,
      bust: r.phase === 'result' ? r.bust : null,
      vaultCut: VAULT_CUT,
      multiplier: r.phase === 'running' ? liveMultiplier(Date.now() - r.startedAt) : 1,
      gatherInMs: r.phase === 'gather' ? Math.max(0, r.gatherEndsAt - Date.now()) : 0,
      crew: this.crewList(),
    };
  }

  private broadcast() {
    this.server.emit('state', this.publicState());
  }
}
