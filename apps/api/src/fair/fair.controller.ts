import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FairService } from './fair.service';
import { ClientSeedDto, RotateDto, VerifyDto } from './fair.dto';

@Controller('fair')
export class FairController {
  constructor(private readonly fair: FairService) {}

  /** Current commitment: the server-seed HASH (never the seed), client seed, nonce. */
  @Get('current')
  current(@Query('sessionId') sessionId: string, @Query('clientSeed') clientSeed?: string) {
    return this.fair.current(sessionId, clientSeed);
  }

  @Post('client-seed')
  setClientSeed(@Body() dto: ClientSeedDto) {
    return this.fair.setClientSeed(dto.sessionId, dto.clientSeed);
  }

  /** Rotate → reveals the old server seed so past bets can be verified. */
  @Post('rotate')
  rotate(@Body() dto: RotateDto) {
    return this.fair.rotate(dto.sessionId);
  }

  @Post('verify')
  verify(@Body() dto: VerifyDto) {
    return this.fair.verify(dto);
  }
}
