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
import { OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

interface Peer {
  id: string;
  name: string;
  ship: string;
  x: number;
  z: number;
}

const clamp = (n: number) => Math.max(-24, Math.min(24, Number.isFinite(n) ? n : 0));

/**
 * Shared 3D plaza presence. Every connected client is a Peer with a position and
 * a ship skin; the server keeps the authoritative roster and broadcasts it at
 * 10 Hz so everyone sees everyone else glide around the same space. Movement is
 * cosmetic (no funds), so it's a lightweight in-memory presence channel.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/plaza' })
export class PlazaGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private peers = new Map<string, Peer>();
  private ticker?: ReturnType<typeof setInterval>;

  afterInit() {
    this.ticker = setInterval(() => {
      if (this.peers.size > 0) this.server.emit('peers', [...this.peers.values()]);
    }, 100);
  }

  onModuleDestroy() {
    if (this.ticker) clearInterval(this.ticker);
  }

  handleConnection(client: Socket) {
    this.peers.set(client.id, { id: client.id, name: 'guest', ship: 'dart', x: 0, z: 0 });
    client.emit('welcome', { id: client.id, online: this.peers.size });
  }

  handleDisconnect(client: Socket) {
    this.peers.delete(client.id);
  }

  @SubscribeMessage('move')
  onMove(@ConnectedSocket() client: Socket, @MessageBody() body: { x?: number; z?: number; name?: string; ship?: string }) {
    const p = this.peers.get(client.id);
    if (!p) return;
    p.x = clamp(Number(body?.x));
    p.z = clamp(Number(body?.z));
    if (body?.name) p.name = String(body.name).slice(0, 16);
    if (body?.ship) p.ship = String(body.ship).slice(0, 12);
  }
}
