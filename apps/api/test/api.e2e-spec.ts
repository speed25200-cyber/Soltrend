import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Soltrend API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /games lists the built-in Originals', async () => {
    const res = await request(app.getHttpServer()).get('/games').expect(200);
    expect(res.body.map((g: any) => g.id)).toEqual(
      expect.arrayContaining(['dice', 'limbo', 'mines', 'plinko', 'wheel', 'coinflip']),
    );
  });

  it('geo-blocks a prohibited jurisdiction', async () => {
    await request(app.getHttpServer()).get('/compliance/geo?country=US').expect(200).expect({ country: 'US', allowed: false });

    await request(app.getHttpServer())
      .post('/games/settle')
      .send({ sessionId: 'geo', player: 'p', gameId: 'dice', bet: 1, country: 'US', params: {} })
      .expect(403);
  });

  it('settles a bet then verifies it end-to-end over HTTP', async () => {
    const http = app.getHttpServer();
    const settle = await request(http)
      .post('/games/settle')
      .send({ sessionId: 'e2e', player: 'wallet', gameId: 'dice', bet: 1, params: { target: 50, over: true } })
      .expect(201);

    const { nonce, clientSeed, multiplier, serverSeedHash, detail } = settle.body;
    expect(nonce).toBe(1);

    const rotate = await request(http).post('/fair/rotate').send({ sessionId: 'e2e' }).expect(201);
    expect(rotate.body.revealed.hashCheck).toBe(true);

    const verify = await request(http)
      .post('/fair/verify')
      .send({
        serverSeed: rotate.body.revealed.serverSeed,
        clientSeed,
        nonce,
        template: 'dice',
        bet: 1,
        edge: 0.01,
        params: { target: 50, over: true },
        expectedHash: serverSeedHash,
      })
      .expect(201);

    expect(verify.body.hashMatches).toBe(true);
    expect(verify.body.outcome.multiplier).toBe(multiplier);
    expect(verify.body.outcome.detail.roll).toBe(detail.roll);
  });

  it('validation rejects a malformed settle body', async () => {
    await request(app.getHttpServer()).post('/games/settle').send({ gameId: 'dice' }).expect(400);
  });
});
