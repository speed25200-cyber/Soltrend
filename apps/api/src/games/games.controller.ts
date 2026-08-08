import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GamesService } from './games.service';
import { RegisterGameDto, SettleDto } from './games.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list() {
    return this.games.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.games.get(id);
  }

  /** Publish a UGC game (validated GameSpec). */
  @Post()
  register(@Body() dto: RegisterGameDto) {
    return this.games.register(
      {
        template: dto.template,
        name: dto.name,
        edge: dto.edge,
        params: dto.params ?? {},
        theme: dto.theme,
      },
      dto.creator,
    );
  }

  /** Settle one bet — the single, compliance-guarded, provably-fair path. */
  @Post('settle')
  settle(@Body() dto: SettleDto) {
    return this.games.settle(dto);
  }
}
